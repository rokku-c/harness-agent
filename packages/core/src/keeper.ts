import { Deferred, Effect, Exit, PubSub, Queue, Scope, Stream } from "effect"
import type { AgentError, AgentProgram, Result } from "./core.js"
import { Messenger, type DeliveryError } from "./messenger.js"

export interface KeeperEvent<O, E> {
  readonly input: unknown
  readonly exit: Exit.Exit<Result<O>, E>
}

interface Job<I, O, E, R> {
  readonly input: I
  readonly result: Deferred.Deferred<Result<O>, E | DeliveryError>
  readonly run: (input: I) => Effect.Effect<Result<O>, E | DeliveryError, R>
}

export interface AgentKeeper<I, O, E = AgentError> {
  readonly send: (input: I) => Effect.Effect<Result<O>, E | DeliveryError>
  readonly events: Effect.Effect<Stream.Stream<KeeperEvent<O, E | DeliveryError>>, never, Scope.Scope>
  readonly shutdown: Effect.Effect<void>
}

export interface AgentKeeperOptions {
  readonly capacity?: number
}

/**
 * Keeps an AgentProgram alive behind an Effect Queue. The program itself remains
 * one-shot; the keeper owns the long-lived Fiber, back-pressure and event stream.
 */
export const AgentKeeper = {
  make: <I, O, E, R>(
    agent: AgentProgram<I, O, E, R>,
    options: AgentKeeperOptions = {}
  ): Effect.Effect<AgentKeeper<I, O, E>, never, Scope.Scope | R | Messenger> => Effect.gen(function*() {
    const messenger = yield* Messenger
    const queue = yield* (options.capacity === undefined
      ? Queue.unbounded<Job<I, O, E, R>>()
      : Queue.bounded<Job<I, O, E, R>>(options.capacity))
    const events = yield* PubSub.unbounded<KeeperEvent<O, E | DeliveryError>>()

    const loop: Effect.Effect<void, never, R> = Effect.gen(function*() {
      const job = yield* Queue.take(queue)
      const exit = yield* Effect.exit(job.run(job.input))
      yield* Deferred.done(job.result, exit)
      yield* PubSub.publish(events, { input: job.input, exit })
      yield* loop
    })

    yield* Effect.forkScoped(loop)

    return {
      send: (input) => Effect.gen(function*() {
        const result = yield* Deferred.make<Result<O>, E | DeliveryError>()
        yield* Queue.offer(queue, { input, result, run: (value) => messenger.deliver(agent, { id: crypto.randomUUID(), payload: value }) })
        return yield* Deferred.await(result)
      }),
      events: Stream.fromPubSub(events, { scoped: true }),
      shutdown: Queue.shutdown(queue).pipe(Effect.zipRight(PubSub.shutdown(events)))
    }
  })
}
