export type ConversationType = "group" | "single"

export interface IncomingMessage {
  readonly id: string
  readonly text: string
  readonly conversationId: string
  readonly conversationType: ConversationType
  readonly senderId: string
  readonly senderNick?: string
  readonly addressed: boolean
  readonly ts: number
}

export interface Reply {
  readonly text: string
  readonly tone: "plain" | "emoji"
}

export type OutgoingTarget =
  | { readonly kind: "direct"; readonly userId: string }
  | { readonly kind: "group"; readonly conversationId: string }

export interface MessageChannel {
  readonly name: string
  readonly listen: (deliver: (message: IncomingMessage) => Promise<Reply | undefined>) => Promise<never>
  readonly send?: (target: OutgoingTarget, text: string) => Promise<void>
}
