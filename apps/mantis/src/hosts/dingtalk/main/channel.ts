/**
 * main/channel.ts - CHANNEL SELECTION.
 *
 * Concept: MANTIS_CHANNEL (or config) picks robot vs dws; the robot channel
 * forwards STREAM card-button clicks to the host through a forward
 * reference (the host is created after the channel). A robot config missing
 * credentials is a startup error; the dws channel defaults to a direct
 * source with the configured me-user.
 */
import { makeDwsChannel, dwsBunRunner } from "../channels/dws.ts"
import { makeRobotChannel, type RobotChannelOptions } from "../channels/robot.ts"

export type CardActionHandler = NonNullable<RobotChannelOptions["cardActionHandler"]>

export const makeChannel = (
  config: {
    channel: string
    robot?: { clientId: string; clientSecret: string }
    dws?: { groupId?: string; userId?: string; meUserId?: string }
  },
  cardActionHandler: CardActionHandler
): ReturnType<typeof makeRobotChannel | typeof makeDwsChannel> => {
  if (config.channel === "robot") {
    const robot = config.robot
    if (robot === undefined) throw new Error("robot channel needs [dingtalk] client_id/client_secret")
    return makeRobotChannel({
      clientId: robot.clientId,
      clientSecret: robot.clientSecret,
      cardActionHandler
    })
  }
  const dws = config.dws
  return makeDwsChannel({
    runner: dwsBunRunner,
    source: dws?.groupId !== undefined
      ? { kind: "group", id: dws.groupId }
      : { kind: "direct", userId: dws?.userId ?? "" },
    meUserId: dws?.meUserId
  })
}
