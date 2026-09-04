/**
 * card/types.ts - the APPROVAL CARD CONTRACT.
 *
 * Concept: a real DingTalk interactive card (createAndDeliver) carries one
 * pending approval. The call id rides the outTrackId ("mantis-approval-<id>")
 * so the card template needs NO dynamic parameters; the template's buttons
 * carry a static callback payload configured in the DingTalk console.
 */
import type { OutgoingTarget } from "../messages.ts"

export type CardAction = { readonly callId: string; readonly action: "approve" | "deny" }

export const approvalOutTrackId = (callId: string): string => "mantis-approval-" + callId
export const callIdFromOutTrackId = (outTrackId: string): string =>
  outTrackId.startsWith("mantis-approval-") ? outTrackId.slice("mantis-approval-".length) : outTrackId

export interface ApprovalCardParams {
  readonly tool: string
  readonly input: unknown
  readonly callId: string
  readonly text: string
}

/** the cardParamMap handed to the template (template variable names) */
export const approvalCardParamMap = (params: ApprovalCardParams, contentKey = "content"): Record<string, string> => ({
  [contentKey]: params.text,
  tool: params.tool,
  input: JSON.stringify(params.input),
  callId: params.callId
})

export interface CardDelivererOptions {
  readonly clientId: string
  readonly clientSecret: string
  readonly cardTemplateId: string
  /** the template variable that carries the card text (default "content") */
  readonly contentKey?: string
}

/** the deliverable seam the host calls to put an approval in front of a human */
export interface CardDeliverer {
  readonly sendApproval: (target: OutgoingTarget, params: ApprovalCardParams) => Promise<void>
}
