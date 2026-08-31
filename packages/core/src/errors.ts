import { Data } from "effect"

/** The agent declined the requested behavior: the driver's capabilities do not cover it. */
export class UnsupportedCapability extends Data.TaggedError("UnsupportedCapability")<{
  readonly agent: string
  readonly required: string
  readonly actual: string
}> {}

/** The agent ran and failed: provider errors, schema failures, exhausted steps. */
export class AgentFailure extends Data.TaggedError("AgentFailure")<{
  readonly agent: string
  readonly cause: unknown
  readonly message?: string
}> {}

/** The agent paused cooperatively: its state is checkpointed under this run id. */
export class AgentPaused extends Data.TaggedError("AgentPaused")<{
  readonly runId: string
}> {}

export type AgentError = UnsupportedCapability | AgentFailure

