/**
 * MockChannel: an in-memory channel for tests. Messages pushed in are
 * delivered immediately (or queued until a listener attaches); replies are
 * recorded for assertions. No polling loop - push() drives delivery.
 */
import type { IncomingMessage, MessageChannel, OutgoingTarget, Reply } from "../messages.ts"

export class MockChannel implements MessageChannel {
  readonly name = "mock"
  readonly sent: Array<{ message: IncomingMessage; reply: Reply }> = []
  readonly outbound: Array<{ target: OutgoingTarget; text: string }> = []
  #deliver: ((message: IncomingMessage) => Promise<Reply | undefined>) | undefined
  #queue: IncomingMessage[] = []

  readonly push = (message: IncomingMessage): Promise<Reply | undefined> => {
    if (this.#deliver === undefined) {
      this.#queue.push(message)
      return Promise.resolve(undefined)
    }
    return this.#pump(message)
  }

  #pump = async (message: IncomingMessage): Promise<Reply | undefined> => {
    const deliver = this.#deliver
    if (deliver === undefined) return undefined
    const reply = await deliver(message)
    if (reply !== undefined) this.sent.push({ message, reply })
    return reply
  }

  send = async (target: OutgoingTarget, text: string): Promise<void> => {
    this.outbound.push({ target, text })
  }

  listen = async (deliver: (message: IncomingMessage) => Promise<Reply | undefined>): Promise<never> => {
    this.#deliver = deliver
    for (const queued of this.#queue.splice(0)) void this.#pump(queued)
    // a listener lives until the process ends (like a real channel)
    return new Promise<never>(() => {})
  }
}
