import { Data } from "effect"

export class UnsupportedCapability extends Data.TaggedError("UnsupportedCapability")<{
  readonly agent: string
  readonly required: string
  readonly actual: string
}> {}

export class AgentFailure extends Data.TaggedError("AgentFailure")<{
  readonly agent: string
  readonly cause: unknown
  readonly message?: string
}> {}

export class AgentPaused extends Data.TaggedError("AgentPaused")<{
  readonly runId: string
}> {}

export type AgentError = UnsupportedCapability | AgentFailure
