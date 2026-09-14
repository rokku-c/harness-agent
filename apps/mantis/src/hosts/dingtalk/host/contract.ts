import type { Model } from "@effect-agent/model"
import type { HarnessHook } from "@effect-agent/core"
import { ManualGate, type PendingApproval } from "@effect-agent/gate"
import type { Logger } from "@effect-agent/logger"
import type { ApprovalPolicy, ApprovalRequest } from "../../../approval.ts"
import type { NotesStore } from "../../../tools.ts"

export interface MantisHostApproval {
  readonly gate: ManualGate
  readonly requires: (request: ApprovalRequest) => boolean
  readonly timeoutMs?: number
  readonly notify?: (pending: PendingApproval) => Promise<void>
}

export interface MantisHostOptions {
  readonly model: Model
  readonly instructions?: (conversationId: string) => string
  readonly maxSteps?: number
  readonly maxReflections?: number
  readonly logger?: Logger
  readonly approval?: MantisHostApproval
  readonly workspace?: NotesStore
  readonly memoryDir?: string
  readonly extraHooks?: ReadonlyArray<HarnessHook<never, never>>
  readonly onTurnFailure?: (conversationId: string, detail: string) => void
}

export type ApprovalLike = MantisHostApproval | undefined

export type PolicyFor = (conversationId: string) => ApprovalPolicy | undefined
