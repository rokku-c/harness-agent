/**
 * host/queue.ts - PER-CONVERSATION TURN SERIALIZATION.
 *
 * Concept: agent turns are serialized per conversation (one promise chain
 * each) to keep session state sane; the returned promise never rejects -
 * a turn failure is digested here (logged + onTurnFailure) instead of
 * crashing the host process (seen live: a decode AgentFailure killed the
 * pm2 console mid-session).
 */
import type { Logger } from "@effect-agent/logger"

export class TurnQueue {
  readonly #chains = new Map<string, Promise<unknown>>()

  constructor(private readonly logger: Logger, private readonly onFailure?: (conversationId: string, detail: string) => void) {}

  enqueue<A>(conversationId: string, run: () => Promise<A | undefined>): Promise<A | undefined> {
    const previous = this.#chains.get(conversationId) ?? Promise.resolve()
    const turn = previous.then(() => run()).catch((error) => {
      const detail = error instanceof Error ? error.message : String(error)
      this.logger.error("session turn failed", { conversationId, error: detail })
      this.onFailure?.(conversationId, detail)
      return undefined
    })
    this.#chains.set(conversationId, turn)
    return turn
  }
}
