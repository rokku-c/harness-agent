/**
 * Barrel: dingtalk approval cards split by CONCEPT (see ./card/).
 * types.ts = contract + track-id mapping; deliver.ts = openapi sending;
 * callback.ts = TOPIC_CARD click parsing.
 */
export type { CardAction, ApprovalCardParams, CardDelivererOptions } from "./card/types.ts"
export { approvalOutTrackId, callIdFromOutTrackId, approvalCardParamMap } from "./card/types.ts"
export { openApiCardDeliverer } from "./card/deliver.ts"
export { parseCardAction } from "./card/callback.ts"
