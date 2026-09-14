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
