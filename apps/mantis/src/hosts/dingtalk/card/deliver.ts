/**
 * card/deliver.ts - SENDING approval cards (openapi).
 *
 * Concept: createAndDeliver one interactive card via the DingTalk card
 * openapi with the robot identity. callbackType STREAM routes the button
 * click back over the dingtalk-stream TOPIC_CARD subscription; the same
 * open space id shapes are used for groups and single chats.
 */
import { DINGTALK_API, robotAccessToken } from "../channels/openapi.ts"
import { approvalOutTrackId, approvalCardParamMap, type ApprovalCardParams, type CardDeliverer, type CardDelivererOptions } from "./types.ts"

/** sends interactive approval cards via the card openapi (robot identity) */
export const openApiCardDeliverer = (options: CardDelivererOptions): CardDeliverer => {
  const contentKey = options.contentKey ?? "content"
  return {
    sendApproval: async (target, params: ApprovalCardParams): Promise<void> => {
      const token = await robotAccessToken(options.clientId, options.clientSecret)
      const isGroup = target.kind === "group"
      const body = {
        cardTemplateId: options.cardTemplateId,
        outTrackId: approvalOutTrackId(params.callId),
        callbackType: "STREAM", // the button click comes back over TOPIC_CARD
        cardData: { cardParamMap: approvalCardParamMap(params, contentKey) },
        openSpaceId: isGroup
          ? `dtv1.card//IM_GROUP.${target.conversationId}`
          : `dtv1.card//IM_ROBOT.${target.userId}`,
        userIdType: 1,
        ...(isGroup
          ? { imGroupOpenDeliverModel: { robotCode: options.clientId, extension: { dynamicSummary: "true" } } }
          : { imRobotOpenDeliverModel: { spaceType: "IM_ROBOT", robotCode: options.clientId, extension: { dynamicSummary: "true" } } })
      }
      const response = await fetch(DINGTALK_API + "/v1.0/card/instances/createAndDeliver", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-acs-dingtalk-access-token": token
        },
        body: JSON.stringify(body)
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error("dingtalk card deliver failed: " + (data.message ?? response.status))
      }
    }
  }
}
