/**
 * channels/robot/channel.ts - the RobotChannel itself.
 *
 * Concept: the bot's inbound subscription (TOPIC_ROBOT messages + TOPIC_CARD
 * approval-button callbacks) wired to delivery. Message handling is
 * concurrent - one approval reply must never queue behind a running agent
 * turn. Normalizing, SDK loading and sending live in the sibling files.
 */
import type { IncomingMessage, MessageChannel, OutgoingTarget, Reply } from "../../messages.ts"
import { parseCardAction } from "../../dingtalk-card.ts"
import { toIncomingRobot } from "./parse.ts"
import { loadDwsSdk, type DwsStreamSdk } from "./sdk.ts"
import { openApiTextSender, postWebhookReply } from "./send.ts"
import type { RobotChannelOptions } from "./sdk.ts"

export const makeRobotChannel = (options: RobotChannelOptions): MessageChannel => {
  const { clientId, clientSecret } = options
  const send: (target: OutgoingTarget, text: string) => Promise<void> = openApiTextSender(clientId, clientSecret)
  return {
    name: "robot:" + clientId.slice(0, 8),
    send,
    listen: async (deliver): Promise<never> => {
      const { DWClient, TOPIC_ROBOT, TOPIC_CARD } = await loadDwsSdk()
      const client = new DWClient({ clientId, clientSecret })
      if (options.cardActionHandler !== undefined) {
        const handler = options.cardActionHandler
        client.registerCallbackListener(TOPIC_CARD, (raw) => {
          const action = parseCardAction(raw)
          if (action !== undefined) void handler(action)
        })
      }
      client.registerCallbackListener(TOPIC_ROBOT, (raw) => {
        const message = toIncomingRobot(raw as Record<string, unknown>)
        if (message === undefined || message.text === "") return
        const webhook =
          typeof (raw as Record<string, unknown>).sessionWebhook === "string"
            ? ((raw as Record<string, unknown>).sessionWebhook as string)
            : ""
        // concurrent: an approval reply must never queue behind a running turn
        void deliver(message).then((reply) => {
          if (reply !== undefined) return postWebhookReply(webhook, reply)
        })
      })
      await client.connect()
      return new Promise<never>(() => {}) // keep the stream alive
    }
  }
}
