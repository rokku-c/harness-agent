import { Context as EffectContext, Data, Effect, Layer, Stream } from "effect"
import type { AgentProgram, AgentError, Result } from "./core.js"

/** 通信模式。 */
export type CommunicationMode = "reply" | "two-way" | "mail"

export interface Delivery<A = unknown> {
  readonly id: string
  readonly payload: A
  readonly source?: string
  readonly target?: string
  readonly correlation?: string
  /** 通信模式：reply=应答，two-way=双向，mail=邮件（异步投递）。 */
  readonly mode?: CommunicationMode
}

export class DeliveryError extends Data.TaggedError("DeliveryError")<{
  readonly cause: unknown
  readonly delivery?: Delivery
}> {}

export interface MessengerService {
  /** 应答通信：投递并等待结果（request/response）。 */
  readonly deliver: <I, O, E, R>(
    agent: AgentProgram<I, O, E, R>,
    delivery: Delivery<I>
  ) => Effect.Effect<Result<O>, E | DeliveryError, R>
  /** 双向通信：建立持续双向流。 */
  readonly connect: <I, O, E, R>(
    agent: AgentProgram<I, O, E, R>,
    delivery: Delivery<I>
  ) => Effect.Effect<Stream.Stream<Result<O>, E | DeliveryError>, never, R>
  /** 邮件通信：异步投递，不等待回复。 */
  readonly send: (delivery: Delivery<unknown>) => Effect.Effect<void, DeliveryError>
}

/** Symmetric delivery boundary for Agent input and output. */
export class Messenger extends EffectContext.Tag("Harness/Messenger")<Messenger, MessengerService>() {
  static layer: Layer.Layer<Messenger> = Layer.succeed(this, {
    deliver: (agent, delivery) => agent.run(delivery.payload) as Effect.Effect<Result<unknown>, never, never>,
    connect: (agent, delivery) => agent.run(delivery.payload).pipe(
      Effect.map((result) => Stream.succeed(result))
    ) as Effect.Effect<Stream.Stream<Result<unknown>>, never, never>,
    send: () => Effect.void
  } as MessengerService)
}

export const makeDelivery = <A>(payload: A, options: Omit<Delivery<A>, "id" | "payload"> = {}): Delivery<A> => ({
  id: crypto.randomUUID(),
  payload,
  ...options
})
