export interface RobotChannelOptions {
  readonly clientId: string
  readonly clientSecret: string
  readonly cardActionHandler?: (action: { callId: string; action: "approve" | "deny" }) => Promise<void> | void
}

export interface DwsStreamSdk {
  DWClient: new (options: { clientId: string; clientSecret: string }) => {
    registerCallbackListener(topic: string, listener: (message: unknown) => Promise<void> | void): void
    connect(): Promise<void>
  }
  TOPIC_ROBOT: string
  TOPIC_CARD: string
}

export const loadDwsSdk = async (): Promise<DwsStreamSdk> => {
  try {
    return (await import("dingtalk-stream")) as unknown as DwsStreamSdk
  } catch {
    throw new Error(
      "RobotChannel needs the dingtalk-stream SDK: run 'bun add dingtalk-stream' " +
        "in apps/mantis, then start the channel with your bot clientId/clientSecret."
    )
  }
}
