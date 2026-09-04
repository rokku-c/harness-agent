/**
 * channels/robot/sdk.ts - the dingtalk-stream SDK SURFACE.
 *
 * Concept: RobotChannel runs on the official dingtalk-stream SDK (the same
 * one the original clawyp uses). The native module is loaded lazily so the
 * rest of mantis stays importable without it; the stream type is the small
 * subset RobotChannel needs (DWClient + TOPIC_ROBOT/TOPIC_CARD).
 */
export interface RobotChannelOptions {
  readonly clientId: string
  readonly clientSecret: string
  /**
   * Approval-card button callbacks (dingtalk-stream TOPIC_CARD). The host
   * wires this to resolve the waiting approval: interactive buttons, no text.
   */
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
