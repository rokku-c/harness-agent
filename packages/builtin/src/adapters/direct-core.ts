import { Effect } from "effect"
import type { AdapterRef, ConnectionAdapter, ConnectionRuntime, JsonValue } from "@effect-agent/core"
import { coreEndpoint, endpointTransport, sessionFromTransport, type CorePolicy } from "../contracts/core.js"

const targetFrom = (ref: AdapterRef) => {
  const config = ref.config
  const record = config && typeof config === "object" && !Array.isArray(config)
    ? config as Readonly<Record<string, JsonValue>>
    : undefined
  return typeof record?.target === "string" ? record.target : "self"
}

/** Expose this Core or another in-process Core as a normal connection. */
export const directCoreAdapter = (options: {
  readonly kind?: string
  readonly resolve: (target: string) => Effect.Effect<ConnectionRuntime, Error>
  readonly policy: CorePolicy
}): ConnectionAdapter => {
  const kind = options.kind ?? "builtin.core.direct"
  return {
    kind,
    capabilities: new Set(["core.describe", "core.invoke", "core.close"]),
    connect: (spec, ref) => options.resolve(targetFrom(ref)).pipe(
      Effect.map((runtime) => coreEndpoint(runtime, options.policy)),
      Effect.map(endpointTransport),
      Effect.map((transport) => sessionFromTransport(spec, kind, transport))
    )
  }
}
