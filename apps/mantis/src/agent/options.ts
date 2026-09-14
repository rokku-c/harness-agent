import type { AgentError, AgentProgram, Binding, HarnessHook } from "@effect-agent/core"
import type { Model } from "@effect-agent/model"
import type { FinalReply } from "../final.ts"
import type { ApprovalPolicy } from "../approval.ts"
import type { ToolSupply } from "../supply.ts"
import type { NotesStore } from "../tools.ts"

export interface MantisOptions {
  readonly model: Model
  readonly notes?: NotesStore
  readonly instructions?: string
  readonly maxSteps?: number
  readonly maxReflections?: number
  readonly initialEnabled?: ReadonlyArray<string>
  readonly onEnabled?: (name: string) => void
  readonly approvals?: ApprovalPolicy
  readonly bindings?: ReadonlyArray<Binding>
  readonly hooks?: ReadonlyArray<HarnessHook<never, never>>
}

export interface Mantis {
  readonly agent: AgentProgram<string, FinalReply, AgentError, never>
  readonly supply: ToolSupply
  readonly notes: NotesStore
  readonly approvals: ApprovalPolicy
}
