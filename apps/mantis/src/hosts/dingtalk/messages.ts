/**
 * DingTalk message normalization across the two channels:
 *   - dws channel  (user identity: polls dws chat message list*)
 *   - robot channel (bot identity: dingtalk-stream TOPIC_ROBOT events)
 * Both produce the same IncomingMessage, so the host never knows the channel.
 * Outbound: where a proactive message (e.g. an approval card) goes.
 */
export type ConversationType = "group" | "single"

export interface IncomingMessage {
  /** message id - the dedupe key across polls */
  readonly id: string
  readonly text: string
  /** openConversationId of the group or the 1:1 session */
  readonly conversationId: string
  readonly conversationType: ConversationType
  readonly senderId: string
  readonly senderNick?: string
  /** whether this message addressed the channel owner (bot @ / direct user message) */
  readonly addressed: boolean
  readonly ts: number
}

export interface Reply {
  readonly text: string
  readonly tone: "plain" | "emoji"
}

/** where a proactive message goes (owner single chat / group) */
export type OutgoingTarget =
  | { readonly kind: "direct"; readonly userId: string }
  | { readonly kind: "group"; readonly conversationId: string }

/** The channel contract: listen() delivers inbound messages and replies. */
export interface MessageChannel {
  readonly name: string
  /** blocks while listening; delivers every inbound message */
  readonly listen: (deliver: (message: IncomingMessage) => Promise<Reply | undefined>) => Promise<never>
  /** proactive outbound (approval cards, reminders); optional per channel */
  readonly send?: (target: OutgoingTarget, text: string) => Promise<void>
}
