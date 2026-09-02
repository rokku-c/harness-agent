/**
 * Delivery: where answers leave (E7 Channel, outbound half). An adapter
 * per transport; delivery is awaited so the caller knows it landed.
 */
import { Context, Effect } from "effect"
import type { OutgoingMessage } from "./types.ts"

export interface DeliveredMessage extends OutgoingMessage {
  readonly sentAt: number
  readonly deliveryId: string
}

export interface DeliveryService {
  readonly send: (message: OutgoingMessage) => Effect.Effect<string, unknown>
  /** Audit access: what this delivery adapter has actually sent. */
  readonly history: () => Effect.Effect<ReadonlyArray<DeliveredMessage>>
}

export class Delivery extends Context.Tag("effect-agent/Delivery")<Delivery, DeliveryService>() {}
