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
  readonly contentKey?: string
}

export interface CardDeliverer {
  readonly sendApproval: (target: OutgoingTarget, params: ApprovalCardParams) => Promise<void>
}
