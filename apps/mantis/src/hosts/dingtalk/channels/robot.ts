/**
 * Barrel: the dingtalk robot channel split by CONCEPT (see ./robot/).
 * parse.ts = payload normalization; sdk.ts = stream SDK surface + options;
 * send.ts = webhook replies + openapi sends; channel.ts = the subscription
 * wiring (makeRobotChannel).
 */
export type { DwsStreamSdk } from "./robot/sdk.ts"
export type { RobotChannelOptions } from "./robot/sdk.ts"
export { loadDwsSdk } from "./robot/sdk.ts"
export { robotMessageText, toIncomingRobot } from "./robot/parse.ts"
export { makeRobotChannel } from "./robot/channel.ts"
