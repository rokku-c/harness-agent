import { Context as EffectContext, Data, Effect, Layer } from "effect"
import type { AgentProgram, AgentError, Result } from "./core.js"

export interface Delivery<A = unknown> {
  readonly id: string
  readonly payload: A
  readonly source?: string
  readonly target?: string
  readonly correlation?: string
}

export class DeliveryError extends Data.TaggedError("DeliveryError")<{
  readonly cause: unknown
  readonly delivery?: Delivery
}> {}

export interface MessengerService {
  readonly deliver: <I, O, E, R>(
    agent: AgentProgram<I, O, E, R>,
    delivery: Delivery<I>
  ) => Effect.Effect<Result<O>, E | DeliveryError, R>
}

/** Symmetric delivery boundary for Agent input and output. */
export class Messenger extends EffectContext.Tag("Harness/Messenger")<Messenger, MessengerService>() {
  static layer: Layer.Layer<Messenger> = Layer.succeed(this, {
    deliver: (agent, delivery) => agent.run(delivery.payload) as Effect.Effect<Result<unknown>, never, never>
  } as MessengerService)
}

export const makeDelivery = <A>(payload: A, options: Omit<Delivery<A>, "id" | "payload"> = {}): Delivery<A> => ({
  id: crypto.randomUUID(),
  payload,
  ...options
})
