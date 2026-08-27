import { Effect } from "effect"
import type { ConnectionAdapter, JsonValue } from "@effect-agent/core"
import type { CoreTransport } from "../contracts/core.js"
import { CoreCapabilities, sessionFromTransport } from "../contracts/core.js"

/** Remote Core/UI bridge; transport creation decides stdio, HTTP, WebSocket, etc. */
export const remoteCoreAdapter = (options: {
  readonly kind: string
  readonly connect: (config: JsonValue | undefined) => Effect.Effect<CoreTransport, Error>
}): ConnectionAdapter => ({
  kind: options.kind,
  capabilities: new Set(Object.values(CoreCapabilities)),
  connect: (spec, ref) => options.connect(ref.config).pipe(
    Effect.map((transport) => sessionFromTransport(spec, options.kind, transport))
  )
})
