import { Effect, Either } from "effect"
import type { CardAction } from "../dingtalk-card.ts"
import type { IncomingMessage, MessageChannel, Reply } from "../messages.ts"
import { ConversationStore } from "../conversation.ts"
import { noopLogger, type Logger } from "@effect-agent/logger"
import { SessionRegistry } from "./sessions.ts"
import { TurnQueue } from "./queue.ts"
import type { MantisHostApproval, MantisHostOptions } from "./contract.ts"

export class MantisHost {
  readonly #options: MantisHostOptions
  readonly #approval?: MantisHostApproval
  readonly #logger: Logger
  readonly #registry: SessionRegistry
  readonly #queue: TurnQueue
  readonly conversations: ConversationStore

  constructor(options: MantisHostOptions) {
    this.#options = options
    this.#approval = options.approval
    this.#logger = options.logger ?? noopLogger()
    const conversations = new ConversationStore(options.memoryDir === undefined ? {} : { dir: options.memoryDir })
    this.conversations = conversations
    this.#registry = new SessionRegistry(options, conversations, this.#logger)
    this.#queue = new TurnQueue(this.#logger, options.onTurnFailure)
    const notify = options.approval?.notify
    if (notify !== undefined && options.approval !== undefined) {
      options.approval.gate.onPending((pending) => {
        void notify(pending).catch((error) => {
          this.#logger.error("approval notify failed", { callId: pending.callId, error })
        })
      })
    }
  }

  readonly session = (conversationId: string) => this.#registry.session(conversationId)

  readonly handleCardAction = async (action: CardAction): Promise<void> => {
    if (this.#approval === undefined) return
    const outcome = await Effect.runPromise(
      this.#approval.gate.resolve(action.callId, action.action === "approve").pipe(Effect.either)
    )
    if (Either.isLeft(outcome))
      this.#logger.debug("card action for unknown/stale approval ignored", { callId: action.callId })
  }

  readonly handle = (message: IncomingMessage): Promise<Reply | undefined> =>
    this.#queue.enqueue(message.conversationId, () => this.deliver(message))

  readonly deliver = async (message: IncomingMessage): Promise<Reply | undefined> => {
    this.conversations.add(message.conversationId, "user", message.text)
    const mantis = this.session(message.conversationId)
    let final: { reply: string; tone: "emoji" | "plain" } | undefined
    try {
      final = await Effect.runPromise(mantis.agent.run(message.text))
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      this.#logger.error("session run failed", { conversationId: message.conversationId, error: detail })
      try {
        this.#options.onTurnFailure?.(message.conversationId, detail)
      } catch {
        // never let the visibility hook itself break the turn
      }
      return undefined
    }
    if (final === undefined) return undefined
    this.conversations.add(message.conversationId, "assistant", final.reply)
    return { text: final.reply, tone: final.tone }
  }

  readonly run = (channel: MessageChannel): Promise<never> =>
    channel.listen((message) => this.handle(message))
}
