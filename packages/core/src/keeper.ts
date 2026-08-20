import { Deferred, Effect, Exit, Fiber, Option, PubSub, Queue, Ref, Scope, Stream } from "effect"
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

/**
 * 运行中的 job 句柄 —— GOAL「可观测/介入」：宿主可暂停/恢复/取消。
 * `pause`/`resume` 用 Deferred 门控（job 在 fiber 里等待 resume）；`cancel` 用 Fiber 中断。
 */
export interface RunningHandle {
  readonly id: string
  /** 暂停运行（Deferred 门控：job 等待 resume）。 */
  readonly pause: Effect.Effect<void>
  /** 恢复运行。 */
  readonly resume: Effect.Effect<void>
  /** 取消（中断 fiber）。 */
  readonly cancel: Effect.Effect<void>
}

export interface AgentKeeper<I, O, E = AgentError> {
  /** 投递并等待结果。 */
  readonly send: (input: I) => Effect.Effect<Result<O>, E | DeliveryError>
  /** 事件流（可观测）。 */
  readonly events: Effect.Effect<Stream.Stream<KeeperEvent<O, E | DeliveryError>>, never, Scope.Scope>
  /** 当前运行中 job 的介入句柄（GOAL「可介入」）。无运行时为 None。 */
  readonly running: Effect.Effect<Option.Option<RunningHandle>>
  /** 关闭。 */
  readonly shutdown: Effect.Effect<void>
}

export interface AgentKeeperOptions {
  readonly capacity?: number
}

/**
 * Keeps an AgentProgram alive behind an Effect Queue. The program itself remains
 * one-shot; the keeper owns the long-lived Fiber, back-pressure and event stream.
 * 每个 job 在一个可中断的 Fiber 里跑 —— 宿主可通过 `running` 拿到当前 handle 介入。
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
    // 当前运行句柄：Ref<Option> —— 无订阅竞态（宿主随时读当前 handle）。
    const current = yield* Ref.make<Option.Option<RunningHandle>>(Option.none())

    const loop: Effect.Effect<void, never, R> = Effect.gen(function*() {
      const job = yield* Queue.take(queue)
      // 暂停门控：pause 时 job 在这里等待，resume 后继续。
      const gate = yield* Deferred.make<void>()
      const paused = yield* Ref.make(false)
      const fiber = yield* Effect.fork(
        job.run(job.input).pipe(
          Effect.tap(() => Ref.get(paused).pipe(
            Effect.flatMap((isPaused) => isPaused ? Deferred.await(gate) : Effect.void)
          ))
        )
      )
      const handle: RunningHandle = {
        id: crypto.randomUUID(),
        pause: Ref.set(paused, true),
        resume: Ref.set(paused, false).pipe(Effect.zipRight(Deferred.succeed(gate, void 0))),
        cancel: Fiber.interrupt(fiber).pipe(Effect.ignore),
      }
      // 设置当前句柄（宿主可读）。
      yield* Ref.set(current, Option.some(handle))
      // Fiber.await 返回 Exit（不抛），中断/完成都统一处理 —— 保证 Deferred 一定被 resolve。
      const exit = yield* Fiber.await(fiber)
      // 清理句柄（job 结束）。
      yield* Ref.set(current, Option.none())
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
      running: Ref.get(current),
      shutdown: Queue.shutdown(queue).pipe(Effect.zipRight(PubSub.shutdown(events)))
    }
  })
}
