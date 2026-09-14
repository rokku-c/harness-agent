import { DINGTALK_API, robotAccessToken } from "../channels/openapi.ts"
import { approvalOutTrackId, approvalCardParamMap, type ApprovalCardParams, type CardDeliverer, type CardDelivererOptions } from "./types.ts"

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
