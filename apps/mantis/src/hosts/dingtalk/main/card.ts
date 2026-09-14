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
