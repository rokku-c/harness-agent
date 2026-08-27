import { Data, Effect, Stream } from "effect"
import type {
  AdapterRef,
  CapabilitySpec,
  ConnectionEvent,
  ConnectionRuntime,
  ConnectionSession,
  ConnectionSpec
} from "@effect-agent/core"

export const CoreCapabilities = {
  describe: "core.describe",
  invoke: "core.invoke",
  close: "core.close"
} as const

export interface CoreDescription {
  readonly connections: ReadonlyArray<{
    readonly id: string
    readonly protocol?: string
    readonly capabilities: ReadonlyArray<CapabilitySpec>
  }>
}

export type CoreRequest =
  | { readonly method: "core.describe" }
  | { readonly method: "core.invoke"; readonly params: { readonly connection: string; readonly capability: string; readonly input: unknown } }
  | { readonly method: "core.close"; readonly params: { readonly connection: string } }

export class CoreProtocolError extends Data.TaggedError("CoreProtocolError")<{ readonly message: string }> {}

export interface CorePolicy {
  readonly authorize: (request: CoreRequest) => Effect.Effect<void, Error>
}

/** Explicit opt-in for trusted in-process links; never selected implicitly. */
export const trustedCorePolicy: CorePolicy = {
  authorize: () => Effect.void
}

/** Common UI policy: observe topology, but do not invoke or close connections. */
export const observeCorePolicy: CorePolicy = {
  authorize: (request) => request.method === "core.describe"
    ? Effect.void
    : Effect.fail(new CoreProtocolError({ message: `Denied by observe-only policy: ${request.method}` }))
}

export const allowCoreCapabilities = (allowed: Readonly<Record<string, ReadonlyArray<string>>>): CorePolicy => ({
  authorize: (request) => {
    if (request.method === "core.describe") return Effect.void
    if (request.method === "core.close")
      return allowed[request.params.connection]?.includes(CoreCapabilities.close)
        ? Effect.void
        : Effect.fail(new CoreProtocolError({ message: `Closing ${request.params.connection} is not allowed` }))
    return allowed[request.params.connection]?.includes(request.params.capability)
      ? Effect.void
      : Effect.fail(new CoreProtocolError({ message: `${request.params.connection}.${request.params.capability} is not allowed` }))
  }
})

/** Server surface shared by a UI client and another Core. */
export interface CoreEndpoint {
  readonly request: (request: CoreRequest) => Effect.Effect<unknown, Error>
  readonly events: Stream.Stream<ConnectionEvent, Error>
}

export const coreEndpoint = (runtime: ConnectionRuntime, policy: CorePolicy): CoreEndpoint => ({
  request: (request) => policy.authorize(request).pipe(Effect.zipRight(Effect.suspend(() => {
    switch (request.method) {
      case "core.describe":
        return runtime.specs().pipe(Effect.map((specs): CoreDescription => ({
          connections: specs.map((spec) => ({
            id: spec.id,
            ...(spec.contract.protocol ? { protocol: spec.contract.protocol } : {}),
            capabilities: spec.contract.capabilities
          }))
        })))
      case "core.invoke": return runtime.invoke(request.params.connection, request.params.capability, request.params.input)
      case "core.close": return runtime.close(request.params.connection)
    }
  }))),
  events: runtime.events()
})

/** Stdio, Streamable HTTP, WebSocket and direct memory links implement this. */
export interface CoreTransport {
  readonly request: (request: CoreRequest) => Effect.Effect<unknown, Error>
  readonly events: Stream.Stream<ConnectionEvent, Error>
  readonly close: Effect.Effect<void, Error>
}

export const endpointTransport = (endpoint: CoreEndpoint): CoreTransport => ({
  request: endpoint.request,
  events: endpoint.events,
  close: Effect.void
})

export const requestOf = (capability: string, input: unknown): Effect.Effect<CoreRequest, Error> => {
  switch (capability) {
    case CoreCapabilities.describe: return Effect.succeed({ method: "core.describe" })
    case CoreCapabilities.invoke: {
      const value = input as Partial<Extract<CoreRequest, { method: "core.invoke" }>["params"]>
      return typeof value?.connection === "string" && typeof value.capability === "string"
        ? Effect.succeed({ method: "core.invoke", params: { connection: value.connection, capability: value.capability, input: value.input } })
        : Effect.fail(new CoreProtocolError({ message: "core.invoke requires connection and capability" }))
    }
    case CoreCapabilities.close: {
      const value = input as { readonly connection?: unknown }
      return typeof value?.connection === "string"
        ? Effect.succeed({ method: "core.close", params: { connection: value.connection } })
        : Effect.fail(new CoreProtocolError({ message: "core.close requires connection" }))
    }
    default: return Effect.fail(new CoreProtocolError({ message: `Unsupported Core capability: ${capability}` }))
  }
}

export const sessionFromTransport = (
  spec: ConnectionSpec,
  adapter: string,
  transport: CoreTransport
): ConnectionSession => ({
  connectionId: spec.id,
  adapter,
  capabilities: new Set(Object.values(CoreCapabilities)),
  invoke: (capability, input) => requestOf(capability, input).pipe(Effect.flatMap(transport.request)),
  events: transport.events,
  close: transport.close
})

export const coreConnectionSpec = (options: {
  readonly id: string
  readonly adapters: ReadonlyArray<AdapterRef>
}): ConnectionSpec => ({
  id: options.id,
  contract: {
    protocol: "effect-agent.core/v1",
    capabilities: [
      { name: CoreCapabilities.describe, input: {}, output: { type: "object" }, mode: "read" },
      { name: CoreCapabilities.invoke, input: { type: "object" }, output: {}, mode: "control" },
      { name: CoreCapabilities.close, input: { type: "object" }, output: {}, mode: "control" }
    ]
  },
  adapters: options.adapters,
  selection: { strategy: "failover" }
})
