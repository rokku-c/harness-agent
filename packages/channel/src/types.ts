/** Channel wire types: what crosses the boundary between the world and the agent. */

export interface IncomingMessage {
  readonly id: string
  readonly conversationId: string
  readonly sender: string
  readonly text: string
  readonly attachments?: ReadonlyArray<{ readonly kind: string; readonly uri: string }>
  readonly at?: number
}

export interface OutgoingMessage {
  readonly conversationId: string
  readonly text: string
  readonly format?: "text" | "markdown" | "card"
  readonly replyTo?: string
  readonly at?: number
}
