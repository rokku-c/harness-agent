import { Context, type PubSub } from "effect"
import type { AgentEvent } from "./event.ts"
import type { StoredCheckpoint } from "./checkpoint.ts"
import type { SignalBox } from "./signal.ts"

export interface AgentSessionService {
  readonly agent: string
  readonly signals: SignalBox
  readonly events: PubSub.PubSub<AgentEvent>
  readonly runId: string
  readonly resume?: StoredCheckpoint
}

export class AgentSession extends Context.Tag("core/AgentSession")<AgentSession, AgentSessionService>() {}
