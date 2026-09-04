/**
 * console/host-builder.ts - WIRING the MantisHost for the console.
 *
 * Concept: one MantisHost per console with the console's seams injected:
 * turn failures leave a visible note, and
 * session events stream to the bus + the ACTIVE conversation's timeline via
 * AsyncLocalStorage attribution (safe when conversations interleave).
 */
import type { Logger } from "@effect-agent/logger"
import type { Model } from "@effect-agent/builtin"
import type { Bus } from "../bus.ts"
import { MantisHost, type MantisHostOptions } from "../../dingtalk/host.ts"
import type { NotesStore } from "../../../tools.ts"
import type { ApprovalRequest } from "../../../approval.ts"
import type { PendingApproval } from "@effect-agent/gate"
import type { ManualGate } from "@effect-agent/gate"
import { eventHook } from "./event-hook.ts"
import { short } from "./helpers.ts"

export interface HostBuildDeps {
  readonly model: Model
  readonly instructions?: (conversationId: string) => string
  readonly maxSteps?: number
  readonly maxReflections?: number
  readonly workspace?: NotesStore
  readonly memoryDir?: string
  readonly logger: Logger
  readonly bus: Bus
  readonly runCtx: () => string | undefined
  readonly approval?: {
    readonly gate: ManualGate
    readonly requires: (request: ApprovalRequest) => boolean
    readonly timeoutMs?: number
    readonly notify?: (pending: PendingApproval) => Promise<void>
  }
  readonly recordNote: (conversationId: string, text: string) => void
  readonly recordTool: (conversationId: string, tool: string, state: "call" | "ok" | "fail", detail: string | undefined) => void
}

export const buildConsoleHost = (deps: HostBuildDeps): MantisHost => {
  const { bus, runCtx, recordNote, recordTool } = deps
  return new MantisHost({
    model: deps.model,
    instructions: deps.instructions,
    maxSteps: deps.maxSteps,
    maxReflections: deps.maxReflections,
    workspace: deps.workspace,
    memoryDir: deps.memoryDir,
    logger: deps.logger,
    approval: deps.approval,
    onTurnFailure: (conversationId, detail) => recordNote(conversationId, "(session failed: " + short(detail, 200) + ")"),
    extraHooks: [eventHook(
      bus,
      runCtx,
      (tool, state, detail) => {
        const conversationId = runCtx()
        if (conversationId !== undefined) recordTool(conversationId, tool, state, detail)
      }
    )]
  })
}
