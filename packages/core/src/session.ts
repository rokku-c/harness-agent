import { Context, type PubSub } from "effect"
import type { AgentEvent } from "./event.ts"
import type { SignalBox } from "./signal.ts"

/**
 * The live session of a running agent: its signal box (who can inject or
 * interrupt it) and its event bus (who can observe it). The runtime provides
 * a session when it spawns an agent; a plain run runs sessionless. The loop
 * discovers it through the context - no signatures change.
 */
export interface AgentSessionService {
  /** The agent id this session belongs to (used to attribute events). */
  readonly agent: string
  readonly signals: SignalBox
  readonly events: PubSub.PubSub<AgentEvent>
}

export class AgentSession extends Context.Tag("core/AgentSession")<AgentSession, AgentSessionService>() {}

