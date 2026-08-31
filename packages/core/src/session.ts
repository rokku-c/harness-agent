import { Context, type PubSub } from "effect"
import type { AgentEvent } from "./event.ts"
import type { StoredCheckpoint } from "./checkpoint.ts"
import type { SignalBox } from "./signal.ts"

/**
 * The live session of a running agent: its signal box (who can inject,
 * interrupt or pause it), its event bus (who can observe it), and its run
 * identity (which keys its checkpoints). A run can also START from an
 * archived checkpoint - the runtime seeds the session, the loop hydrates.
 * The runtime provides a session when it spawns an agent; a plain run runs
 * sessionless. The loop discovers it through the context - no signatures
 * change.
 */
export interface AgentSessionService {
  /** The agent id this session belongs to (used to attribute events). */
  readonly agent: string
  readonly signals: SignalBox
  readonly events: PubSub.PubSub<AgentEvent>
  /** Identifies this run; checkpoints are keyed by it. */
  readonly runId: string
  /** When set, the run hydrates from this archived checkpoint first. */
  readonly resume?: StoredCheckpoint
}

export class AgentSession extends Context.Tag("core/AgentSession")<AgentSession, AgentSessionService>() {}

