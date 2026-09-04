/**
 * console/approvals.ts - the CONSOLE AS OPERATOR.
 *
 * Concept: the console IS the operator: protected calls hang on a shared
 * ManualGate, and each pending Ask is announced on the bus (the panel + MCP
 * render it as an approval request). Resolving pushes approval.resolved.
 */
import { Effect } from "effect"
import { ManualGate, type PendingApproval } from "@effect-agent/gate"
import type { Bus } from "../bus.ts"
import type { ApprovalRequest } from "../../../approval.ts"

export const buildConsoleApproval = (
  protectedTools: ReadonlyArray<string>,
  timeoutMs: number | undefined,
  bus: Bus
): { gate: ManualGate; approval: { gate: ManualGate; requires: (request: ApprovalRequest) => boolean; timeoutMs?: number; notify: (pending: PendingApproval) => Promise<void> } | undefined } => {
  const gate = protectedTools.length === 0 ? undefined : new ManualGate(() => true)
  if (gate === undefined) return { gate: undefined as unknown as ManualGate, approval: undefined }
  return {
    gate,
    approval: {
      gate,
      requires: (request: ApprovalRequest) => protectedTools.includes(request.tool),
      timeoutMs,
      notify: (pending: PendingApproval) => {
        bus.push({ type: "approval.pending", callId: pending.callId, tool: pending.input.tool, input: pending.input.input })
        return Promise.resolve()
      }
    }
  }
}

export const resolveApproval = async (gate: ManualGate | undefined, bus: Bus, callId: string, allow: boolean): Promise<{ ok: boolean; detail?: string }> => {
  if (gate === undefined) return { ok: false, detail: "no approvals configured" }
  const outcome = await Effect.runPromise(gate.resolve(callId, allow).pipe(Effect.either))
  if (outcome._tag === "Left") return { ok: false, detail: "unknown or stale call id" }
  bus.push({ type: "approval.resolved", callId, allow })
  return { ok: true }
}

export const pendingApprovals = (gate: ManualGate | undefined): ReadonlyArray<PendingApproval> =>
  gate === undefined ? [] : Effect.runSync(gate.listPending())
