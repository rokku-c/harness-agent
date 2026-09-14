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
    meUserId: dws?.meUserId ?? ""
  })
}
