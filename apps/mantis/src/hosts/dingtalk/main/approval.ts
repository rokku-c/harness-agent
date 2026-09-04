/**
 * main/approval.ts - the APPROVAL POLICY for this live host.
 *
 * Concept: tools named in MANTIS_PROTECTED hang on a shared ManualGate;
 * every Ask is delivered to the owner (direct user or group) as a REAL
 * interactive approval card; button clicks resolve the call. Missing owner
 * or missing card template are startup errors (there is no textual
 * fallback); a denial surfaces as a recoverable tool error the agent
 * answers.
 */
import { ManualGate, type PendingApproval } from "@effect-agent/gate"
import type { Logger } from "@effect-agent/logger"
import type { ApprovalRequest } from "../../../approval.ts"
import type { CardDeliverer } from "./card.ts"

export const makeApproval = (
  config: {
    approvals: {
      protectedTools: string[]
      ownerId?: string
      ownerGroup?: string
      timeoutMs?: number
    }
  },
  cardDeliverer: CardDeliverer,
  logger: Logger
):
  | {
      gate: ManualGate
      requires: (request: ApprovalRequest) => boolean
      timeoutMs?: number
      notify: (pending: PendingApproval) => Promise<void>
    }
  | undefined => {
  const protectedTools = config.approvals.protectedTools
  if (protectedTools.length === 0) return undefined
  const ownerId = config.approvals.ownerId
  const ownerGroup = config.approvals.ownerGroup
  if (ownerId === undefined && ownerGroup === undefined)
    throw new Error(
      "MANTIS_PROTECTED needs MANTIS_OWNER_ID (single chat) or MANTIS_OWNER_GROUP (group) for the approval card"
    )
  const ownerTarget = ownerGroup !== undefined
    ? { kind: "group" as const, conversationId: ownerGroup }
    : { kind: "direct" as const, userId: ownerId as string }
  if (cardDeliverer === undefined)
    throw new Error(
      "approvals need a REAL DingTalk interactive card: run the robot channel with " +
        "[dingtalk] card_template_id set (create the template in the DingTalk developer " +
        "console, variables content/tool/input/callId + 同意/拒绝 buttons - see README)"
    )
  const gate = new ManualGate(() => true)
  return {
    gate,
    requires: (request: ApprovalRequest) => protectedTools.includes(request.tool),
    timeoutMs: config.approvals.timeoutMs,
    notify: async (pending: PendingApproval) => {
      await cardDeliverer.sendApproval(ownerTarget, {
        tool: pending.input.tool,
        input: pending.input.input,
        callId: pending.callId,
        text: "mantis needs your approval"
      })
      logger.info("approval card sent", { tool: pending.input.tool, callId: pending.callId })
    }
  }
}
