/**
 * host/contract.ts - the MantisHost OPTIONS CONTRACT.
 *
 * Concept: what the host needs to run dingtalk sessions - a model, an
 * optional shared workspace store, durable conversation memory, an optional
 * approval console (shared ManualGate + which calls are protected), hooks and
 * failure visibility. Channel
 * agnostic: only IncomingMessage/Reply cross this seam.
 */
import type { Model } from "@effect-agent/builtin"
import type { HarnessHook } from "@effect-agent/core"
import { ManualGate, type PendingApproval } from "@effect-agent/gate"
import type { Logger } from "@effect-agent/logger"
import type { ApprovalPolicy, ApprovalRequest } from "../../../approval.ts"
import type { NotesStore } from "../../../tools.ts"

export interface MantisHostApproval {
  /** the shared operator console */
  readonly gate: ManualGate
  /** which tool calls are protected (tool name / input based) */
  readonly requires: (request: ApprovalRequest) => boolean
  readonly timeoutMs?: number
  /** forward the interactive approval card to the owner */
  readonly notify?: (pending: PendingApproval) => Promise<void>
}

export interface MantisHostOptions {
  readonly model: Model
  /** optional per-conversation persona; defaults to the mantis instructions */
  readonly instructions?: (conversationId: string) => string
  readonly maxSteps?: number
  /** reflect passes per session (config agent.reflection.max_passes) */
  readonly maxReflections?: number
  /**
   * Unified logger (console/file/composite sinks). Errors and every session
   * event go here; default is silent (noop) so embedding hosts opt in.
   */
  readonly logger?: Logger
  /** Approval console shared across conversations; omit to run unapproved. */
  readonly approval?: MantisHostApproval
  /**
   * Optional SHARED workspace store injected into every session (default:
   * each session keeps its own isolated store). One durable instance here
   * makes the workspace a product-level resource humans and agents share.
   */
  readonly workspace?: NotesStore
  /**
   * Optional directory for DURABLE conversation memory (append-only JSONL).
   * When set, every conversation's turns reload on restart and each session
   * agent still remembers its prior turns. Omit for in-memory memory.
   */
  readonly memoryDir?: string
  /**
   * Extra session hooks (e.g. the web console streams tool activity into its
   * observability bus). Appended after the built-in session log hook.
   */
  readonly extraHooks?: ReadonlyArray<HarnessHook<never, never>>
  /** notified when a turn fails (decode error etc.) - lets a console surface the failure */
  readonly onTurnFailure?: (conversationId: string, detail: string) => void
}

export type ApprovalLike = MantisHostApproval | undefined

export type PolicyFor = (conversationId: string) => ApprovalPolicy | undefined
