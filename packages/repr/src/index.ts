import { Effect, Fiber, PubSub, Ref, Stream } from "effect"
import type {
  AdapterRef,
  CapabilitySpec,
  ConnectionAdapter,
  ConnectionEvent,
  ConnectionSession,
  ConnectionSpec
} from "@effect-agent/core"
import {
  CoreCapabilities,
  type CoreDescription,
  type CoreTransport
} from "@effect-agent/builtin"

export type ConnectionStatus = "idle" | "active" | "failed"

export interface ReprConnection {
  readonly id: string
  readonly protocol?: string
  readonly capabilities: ReadonlyArray<CapabilitySpec>
  readonly status: ConnectionStatus
  readonly lastEvent?: string
}

export interface ReprEvent {
  readonly sequence: number
  readonly connectionId: string
  readonly adapter: string
  readonly kind: string
  readonly payload?: unknown
}

export interface ReprInvocation {
  readonly connection: string
  readonly capability: string
  readonly status: "running" | "succeeded" | "failed"
  readonly input: unknown
  readonly output?: unknown
  readonly error?: string
}

export interface ReprSnapshot {
  readonly revision: number
  readonly connections: ReadonlyArray<ReprConnection>
  readonly selected?: string
  readonly filter: string
  readonly events: ReadonlyArray<ReprEvent>
  readonly invocations: Readonly<Record<string, ReprInvocation>>
}

export type ReprIntent =
  | { readonly type: "refresh" }
  | { readonly type: "select"; readonly connection?: string }
  | { readonly type: "filter"; readonly value: string }
  | { readonly type: "invoke"; readonly connection: string; readonly capability: string; readonly input: unknown }
  | { readonly type: "close"; readonly connection: string }
  | { readonly type: "clear-events" }

export interface ReprClient {
  readonly snapshot: Effect.Effect<ReprSnapshot>
  readonly dispatch: (intent: ReprIntent) => Effect.Effect<unknown, Error>
  readonly changes: Stream.Stream<ReprSnapshot>
  readonly close: Effect.Effect<void, Error>
}

interface ReprState extends ReprSnapshot {}

const statuses = (events: ReadonlyArray<ReprEvent>) => {
  const result = new Map<string, Pick<ReprConnection, "status" | "lastEvent">>()
  for (const event of events) {
    const status: ConnectionStatus = event.kind === "connection.failed"
      ? "failed"
      : event.kind === "connection.invoking" || event.kind === "connection.opened"
        ? "active"
        : "idle"
    result.set(event.connectionId, { status, lastEvent: event.kind })
  }
  return result
}

const viewConnections = (
  description: CoreDescription,
  events: ReadonlyArray<ReprEvent>
): ReadonlyArray<ReprConnection> => {
  const current = statuses(events)
  return description.connections.map((connection) => ({
    ...connection,
    status: current.get(connection.id)?.status ?? "idle",
    ...(current.get(connection.id)?.lastEvent ? { lastEvent: current.get(connection.id)?.lastEvent } : {})
  }))
}

export class ReprRuntime implements ReprClient {
  private constructor(
    private readonly source: CoreTransport,
    private readonly state: Ref.Ref<ReprState>,
    private readonly changesBus: PubSub.PubSub<ReprSnapshot>,
    private readonly eventLimit: number
  ) {}
  private eventFiber?: Fiber.RuntimeFiber<void, Error>

  static connect(source: CoreTransport, options: { readonly eventLimit: number }) {
    return Effect.gen(function* () {
      const described = (yield* source.request({ method: CoreCapabilities.describe })) as CoreDescription
      const initial: ReprState = {
        revision: 0,
        connections: viewConnections(described, []),
        selected: described.connections[0]?.id,
        filter: "",
        events: [],
        invocations: {}
      }
      const state = yield* Ref.make(initial)
      const changesBus = yield* PubSub.unbounded<ReprSnapshot>()
      const runtime = new ReprRuntime(source, state, changesBus, options.eventLimit)
      const eventFiber = yield* Stream.runForEach(source.events, (event) => runtime.receive(event)).pipe(Effect.forkDaemon)
      runtime.eventFiber = eventFiber
      // Let the event fiber acquire its PubSub subscription before callers invoke.
      yield* Effect.yieldNow()
      return runtime
    })
  }

  private update(change: (state: ReprState) => ReprState) {
    const self = this
    return Effect.gen(function* () {
      const next = yield* Ref.updateAndGet(self.state, (state) => ({ ...change(state), revision: state.revision + 1 }))
      yield* PubSub.publish(self.changesBus, next)
      return next
    })
  }

  private receive(event: ConnectionEvent) {
    return this.update((state) => {
      const nextEvent: ReprEvent = { sequence: state.events.at(-1)?.sequence ?? 0, ...event }
      const events = [...state.events, { ...nextEvent, sequence: nextEvent.sequence + 1 }].slice(-this.eventLimit)
      return { ...state, events, connections: state.connections.map((connection) => {
        if (connection.id !== event.connectionId) return connection
        const status: ConnectionStatus = event.kind === "connection.failed"
          ? "failed"
          : event.kind === "connection.invoking" || event.kind === "connection.opened"
            ? "active"
            : "idle"
        return { ...connection, status, lastEvent: event.kind }
      }) }
    }).pipe(Effect.asVoid)
  }

  get snapshot() { return Ref.get(this.state) }
  get changes() { return Stream.fromPubSub(this.changesBus) }

  dispatch(intent: ReprIntent): Effect.Effect<unknown, Error> {
    const self = this
    switch (intent.type) {
      case "refresh": return Effect.gen(function* () {
        const description = (yield* self.source.request({ method: CoreCapabilities.describe })) as CoreDescription
        return yield* self.update((state) => ({ ...state, connections: viewConnections(description, state.events) }))
      })
      case "select": return this.update((state) => ({ ...state, selected: intent.connection }))
      case "filter": return this.update((state) => ({ ...state, filter: intent.value }))
      case "clear-events": return this.update((state) => ({ ...state, events: [] }))
      case "invoke": return Effect.gen(function* () {
        yield* self.update((state) => ({
          ...state,
          invocations: {
            ...state.invocations,
            [intent.connection]: {
              connection: intent.connection,
              capability: intent.capability,
              status: "running",
              input: intent.input
            }
          }
        }))
        return yield* self.source.request({
          method: CoreCapabilities.invoke,
          params: { connection: intent.connection, capability: intent.capability, input: intent.input }
        }).pipe(
          Effect.tap((output) => self.update((state) => ({
            ...state,
            invocations: {
              ...state.invocations,
              [intent.connection]: {
                connection: intent.connection,
                capability: intent.capability,
                status: "succeeded",
                input: intent.input,
                output
              }
            }
          }))),
          Effect.tapError((error) => self.update((state) => ({
            ...state,
            invocations: {
              ...state.invocations,
              [intent.connection]: {
                connection: intent.connection,
                capability: intent.capability,
                status: "failed",
                input: intent.input,
                error: String(error)
              }
            }
          })))
        )
      })
      case "close": return this.source.request({
        method: CoreCapabilities.close,
        params: { connection: intent.connection }
      })
    }
  }

  get close() {
    const interrupt = this.eventFiber ? Fiber.interrupt(this.eventFiber) : Effect.void
    return interrupt.pipe(
      Effect.zipRight(PubSub.shutdown(this.changesBus)),
      Effect.zipRight(this.source.close)
    )
  }
}

export const ReprCapabilities = {
  snapshot: "repr.snapshot",
  dispatch: "repr.dispatch"
} as const

export const reprConnectionSpec = (options: {
  readonly id: string
  readonly adapters: ReadonlyArray<AdapterRef>
}): ConnectionSpec => ({
  id: options.id,
  contract: {
    protocol: "effect-agent.repr/v1",
    capabilities: [
      { name: ReprCapabilities.snapshot, input: {}, output: { type: "object" }, mode: "read" },
      { name: ReprCapabilities.dispatch, input: { type: "object" }, output: {}, mode: "control" }
    ]
  },
  adapters: options.adapters,
  selection: { strategy: "failover" }
})

/** Both TUI and WebUI consume Repr through this same Connection adapter. */
export const reprAdapter = (options: {
  readonly kind?: string
  readonly resolve: (target: string) => Effect.Effect<ReprClient, Error>
}): ConnectionAdapter => {
  const kind = options.kind ?? "builtin.repr.direct"
  return {
    kind,
    capabilities: new Set(Object.values(ReprCapabilities)),
    connect: (spec, ref): Effect.Effect<ConnectionSession, Error> => {
      const config = ref.config as { readonly target?: unknown } | undefined
      const target = typeof config?.target === "string" ? config.target : "default"
      return options.resolve(target).pipe(Effect.map((repr) => ({
        connectionId: spec.id,
        adapter: kind,
        capabilities: new Set(Object.values(ReprCapabilities)),
        invoke: (capability, input) => capability === ReprCapabilities.snapshot
          ? repr.snapshot
          : capability === ReprCapabilities.dispatch
            ? repr.dispatch(input as ReprIntent)
            : Effect.fail(new Error(`Unsupported Repr capability: ${capability}`)),
        close: Effect.void
      })))
    }
  }
}
