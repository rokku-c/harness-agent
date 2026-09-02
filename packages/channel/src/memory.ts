/**
 * MemoryChannel: the open-box default for both halves (M1). A queue of
 * incoming messages and an append-only delivery log - enough to run an
 * agent headlessly and test it end to end.
 */
import { Effect, Layer, Ref } from "effect"
import { randomUUID } from "node:crypto"
import type { IncomingMessage, OutgoingMessage } from "./types.ts"
import { Ingress, type IngressService } from "./ingress.ts"
import { Delivery, type DeliveredMessage, type DeliveryService } from "./delivery.ts"

export interface MemoryChannelConfig {
  /** Pre-seed the inbound queue (tests / scripted scenarios). */
  readonly seed?: ReadonlyArray<IncomingMessage>
}

export class MemoryChannel {
  readonly ingress: IngressService
  readonly delivery: DeliveryService
  private readonly inbox: Array<IncomingMessage>
  private readonly ledger: Ref.Ref<ReadonlyArray<DeliveredMessage>>

  constructor(config: MemoryChannelConfig = {}) {
    this.inbox = [...(config.seed ?? [])]
    this.ledger = Ref.unsafeMake<ReadonlyArray<DeliveredMessage>>([])
    const inbox = this.inbox
    const ledger = this.ledger
    this.ingress = {
      read: () =>
        Effect.sync(() => {
          const next = inbox.shift()
          return next
        }).pipe(Effect.runPromise),
      depth: () => Effect.sync(() => inbox.length).pipe(Effect.runPromise)
    }
    this.delivery = {
      send: (message: OutgoingMessage) =>
        Effect.gen(function* () {
          const delivered: DeliveredMessage = { ...message, sentAt: Date.now(), deliveryId: randomUUID() }
          yield* Ref.update(ledger, (entries) => [...entries, delivered])
          return delivered.deliveryId
        }),
      history: () => Ref.get(ledger)
    }
  }

  /** Scripted helpers for tests. */
  push = (message: IncomingMessage) => this.inbox.push(message)
}

/** The Channel Layer: provides both Ingress and Delivery from one instance. */
export const MemoryChannelLayer = (config: MemoryChannelConfig = {}): Layer.Layer<Ingress | Delivery> => {
  const channel = new MemoryChannel(config)
  return Layer.merge(
    Layer.succeed(Ingress, channel.ingress),
    Layer.succeed(Delivery, channel.delivery)
  )
}
