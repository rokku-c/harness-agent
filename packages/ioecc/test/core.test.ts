import { describe, expect, test } from "bun:test"
import { Effect, Fiber, Layer, Schema, Stream } from "effect"
import {
  Agent,
  ControlExecutor,
  ControlRunner,
  DeclaredControl,
  DeclaredEffect,
  EffectExecutor,
  Observability,
  defaultExecutors,
  makeAgent,
  observabilityLayer,
} from "../src/index.js"

/* ── 具体的 Effect / Control 声明 ── */

/** 读天气：目标 connection = "weather"，输出 string。 */
class FetchWeather implements DeclaredEffect<string> {
  readonly _kind = "Effect" as const
  readonly _tag = "FetchWeather" as const
  readonly connection = "weather"
  readonly outputSchema = Schema.String
  constructor(readonly city: string) {}
}

/** OnInput 触发器：输入 { city }，输出 void。 */
class OnInput implements DeclaredControl<{ city: string }, void> {
  readonly _kind = "Control" as const
  readonly _tag = "OnInput" as const
  readonly inputSchema = Schema.Struct({ city: Schema.String })
  readonly outputSchema = Schema.Void
}

/** 一个「天气 agent」：OnInput 触发，run 声明 FetchWeather Effect。 */
const weatherAgent: Agent<
  FetchWeather,
  [ControlRunner<{ city: string }, void, EffectExecutor>],
  never
> = makeAgent({
  controls: [{
    trigger: new OnInput(),
    run: (input) => Effect.gen(function* () {
      const exec = yield* EffectExecutor
      const weather = yield* exec.execute(new FetchWeather(input.city))
      return undefined
    }),
  }],
})

/* ── Connection 实现：解释 FetchWeather ── */

const weatherConnection = Layer.effect(EffectExecutor, Effect.succeed({
  execute: <Out>(effect: DeclaredEffect<Out>) => {
    if (effect._tag === "FetchWeather") {
      const w = effect as unknown as FetchWeather
      return Effect.succeed(`Sunny in ${w.city}`) as unknown as Effect.Effect<Out, Error>
    }
    return Effect.fail(new Error(`Unknown effect ${effect._tag}`))
  },
}))

const driveAgent = (agent: typeof weatherAgent, input: { city: string }) =>
  Effect.gen(function* () {
    const ctl = yield* ControlExecutor
    const runner = agent.controls[0]!
    return yield* ctl.control(runner.trigger, input, runner.run)
  })

describe("IOECC 核心（单文件）", () => {
  test("EffectExecutor 把 Effect 声明路由到 Connection", async () => {
    const out = await Effect.runPromise(
      driveAgent(weatherAgent, { city: "Shanghai" }).pipe(
        Effect.provide(weatherConnection),
        Effect.provide(defaultExecutors)
      )
    )
    expect(out).toBeUndefined()
  })

  test("Observability 记录 Effect 声明（白盒化）", async () => {
    // 记录发生在 Executor 层（拦截声明）。这个 executor 把每个 FetchWeather 记录到 Obs。
    const recordingConn = Layer.effect(EffectExecutor, Effect.gen(function* () {
      const world = yield* Observability
      return {
        execute: <Out>(effect: DeclaredEffect<Out>) => Effect.gen(function* () {
          if (effect._tag !== "FetchWeather") return yield* Effect.fail(new Error(`Unknown ${effect._tag}`))
          const result = `Sunny in ${(effect as unknown as FetchWeather).city}`
          yield* world.record({ _tag: "Effect", effect: effect as unknown as DeclaredEffect<unknown>, result })
          return result as Out
        }),
      }
    }))

    const program = Effect.scoped(Effect.gen(function* () {
      const world = yield* Observability
      const sub = yield* world.subscribe
      // 订阅并取第一个 Effect 事件（PubSub 无界流不会自然结束）。
      const first = yield* Effect.fork(sub.pipe(Stream.take(1), Stream.runHead))
      yield* driveAgent(weatherAgent, { city: "Beijing" }).pipe(
        Effect.provide(recordingConn),
        Effect.provide(defaultExecutors)
      )
      const got = yield* Fiber.join(first)
      return got
    }))
    const head = await Effect.runPromise(program.pipe(Effect.provide(observabilityLayer)))
    expect(head._tag).toBe("Some")
  })

  test("存在性约束：全 void 的 Agent 在类型标注点被拒绝（@ts-expect-error）", () => {
    const dead: Agent<never, [ControlRunner<void, void, never>], never> = {
      // @ts-expect-error —— 死节点（I/O/E 全 void）在编译期被拒绝。
      __existence: true,
      controls: [{
        trigger: new (class implements DeclaredControl<void, void> {
          readonly _kind = "Control" as const
          readonly _tag = "Void" as const
          readonly inputSchema = Schema.Void
          readonly outputSchema = Schema.Void
        })(),
        run: () => Effect.void,
      }],
    }
    void dead
  })

  test("ControlExecutor 用 inputSchema 解码输入后驱动 run", async () => {
    const probeAgent: Agent<never, [ControlRunner<{ x: number }, string, never>], never> = makeAgent({
      controls: [{
        trigger: new (class implements DeclaredControl<{ x: number }, string> {
          readonly _kind = "Control" as const
          readonly _tag = "Probe" as const
          readonly inputSchema = Schema.Struct({ x: Schema.Number })
          readonly outputSchema = Schema.String
        })(),
        run: (input) => Effect.succeed(`got ${input.x}`),
      }],
    })
    const out = await Effect.runPromise(
      Effect.gen(function* () {
        const ctl = yield* ControlExecutor
        const runner = probeAgent.controls[0]!
        return yield* ctl.control(runner.trigger, { x: 42 }, runner.run)
      }).pipe(Effect.provide(defaultExecutors))
    )
    expect(out).toBe("got 42")
  })
})
