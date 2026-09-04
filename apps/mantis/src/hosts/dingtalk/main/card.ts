/**
 * main/card.ts - INTERACTIVE APPROVAL CARD DELIVERER.
 *
 * Concept: approvals are delivered as REAL DingTalk interactive cards
 * (createAndDeliver + STREAM callback) - the owner clicks 同意/拒绝 and the
 * button click resolves the call via its outTrackId; no text parsing
 * anywhere. Only wired when the robot channel has a card template id.
 */
import { openApiCardDeliverer } from "../dingtalk-card.ts"

export type CardDeliverer = ReturnType<typeof openApiCardDeliverer> | undefined

export const makeCardDeliverer = (config: {
  channel: string
  robot?: { cardTemplateId?: string; clientId: string; clientSecret: string }
}): CardDeliverer => {
  if (config.channel !== "robot" || config.robot === undefined) return undefined
  const cardTemplateId = (config.robot.cardTemplateId ?? "").trim()
  return cardTemplateId === ""
    ? undefined
    : openApiCardDeliverer({
        clientId: config.robot.clientId,
        clientSecret: config.robot.clientSecret,
        cardTemplateId
      })
}
