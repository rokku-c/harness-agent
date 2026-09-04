/**
 * Minimal type stub for the optional dingtalk-stream dependency (the SDK the
 * original clawyp uses for the robot channel). The channel loads it lazily -
 * install it with: bun add dingtalk-stream
 */
declare module "dingtalk-stream" {
  export interface DWClientDownStream {
    text?: unknown
    content?: unknown
    markdown?: unknown
    conversationId?: string
    conversationType?: string
    senderStaffId?: string
    senderNick?: string
    msgId?: string
    robotCode?: string
    sessionWebhook?: string
    sessionWebhookExpiredTime?: number
    isInAtList?: boolean
    isAdmin?: boolean
    [key: string]: unknown
  }
  export class DWClient {
    constructor(options: { clientId: string; clientSecret: string })
    registerCallbackListener(topic: string, listener: (message: DWClientDownStream) => Promise<void> | void): void
    connect(): Promise<void>
  }
  export const TOPIC_ROBOT: string
}
