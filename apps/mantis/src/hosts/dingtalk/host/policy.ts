/**
 * host/policy.ts - the per-conversation APPROVAL POLICY adapter.
 *
 * Concept: protected calls must carry their session (= conversationId) so a
 * shared ManualGate can attribute every Ask to the right conversation. The
 * host builds one adapter per conversation from the shared console - the
 * requires() test is shared, ask() forwards into the gate with the session.
 */
import type { ApprovalPolicy } from "../../../approval.ts"
import type { ApprovalLike } from "./contract.ts"

export const makeApprovalPolicy = (approval: ApprovalLike, conversationId: string): ApprovalPolicy | undefined => {
  if (approval === undefined) return undefined
  return {
    requires: approval.requires,
    ask: (request, ms) =>
      approval.gate.request(
        { tool: request.tool, input: request.input, access: request.access, session: conversationId },
        ms ?? approval.timeoutMs
      )
  }
}
