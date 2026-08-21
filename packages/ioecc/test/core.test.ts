import { describe, expect, test } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import {
  Agent,
  ControlExecutor,
  ControlIntent,
  EffectExecutor,
  EffectIntent,
} from "../src/index.js"

/**
 * 端到端验证核心能支撑真实流程：
 * 一个「天气报告 agent」从声明到跑完 —— 静态触发 → 声明 E(查天气) → 声明动态 C(Fork 归档)
 * → Connection 执行 → 产出最终 O。
 */

/* ── 静态 Trigger：OnInput（携带触发后的行为） ── */
class OnInput<I, O, R = never> implements ControlIntent<I, O> {
  readonly _kind = "Control" as const
  readonly _tag = "OnInput" as const
  constructor(
    readonly payload: I,
    readonly resultSchema: Schema.Schema<O>,
    readonly handle: (input: I) => Effect.Effect<O, Error, R>
  ) {}
}

/* ── 动态 Control：Fork 子 agent 归档结果 ── */
class ForkArchiver implements ControlIntent<{ city: string }, string> {
  readonly _kind = "Control" as const
  readonly _tag = "ForkArchiver" as const
  constructor(
    readonly payload: { city: string },
    readonly resultSchema: Schema.Schema<string> = Schema.String
  ) {}
}

/* ── E：查天气 ── */
class FetchWeather implements EffectIntent<{ city: string }, string> {
  readonly _kind = "Effect" as const
  readonly _tag = "FetchWeather" as const
  constructor(
    readonly payload: { city: string },
    readonly resultSchema: Schema.Schema<string> = Schema.String
  ) {}
}

/* ── Connection：真实天气服务（解释 FetchWeather） ── */
const weatherService = Layer.effect(EffectExecutor, Effect.succeed({
  execute: <P, R>(intent: EffectIntent<P, R>) =>
    intent._tag === "FetchWeather"
      ? Effect.succeed(`Sunny ${(intent as unknown as FetchWeather).payload.city}`) as unknown as Effect.Effect<R, Error>
      : Effect.fail(new Error(`Unknown effect ${intent._tag}`)),
}))

/* ── 天气报告 agent ── */
const reportAgent: Agent = {
  controls: [
    new OnInput({ city: "Shanghai" }, Schema.String, () =>
      Effect.gen(function* () {
        const exec = yield* EffectExecutor
        const ctl = yield* ControlExecutor
        // 1. 声明 E：查天气
        const weather = yield* exec.execute(new FetchWeather({ city: "Shanghai" }))
        // 2. 声明动态 C：fork 一个归档子任务
        yield* ctl.control(new ForkArchiver({ city: "Shanghai" }))
        // 3. 产出 O
        return `Report: ${weather}`
      })),
  ],
}

/* ── Harness：解释静态触发 + 动态控制 ── */
const harness = Layer.effect(ControlExecutor, Effect.succeed({
  control: <P, R>(intent: ControlIntent<P, R>) => {
    if (intent._tag === "OnInput") {
      const t = intent as unknown as OnInput<unknown, unknown>
      return t.handle(t.payload) as unknown as Effect.Effect<R, Error>
    }
    if (intent._tag === "ForkArchiver") {
      const f = intent as unknown as ForkArchiver
      return Effect.succeed(`archived:${f.payload.city}`) as unknown as Effect.Effect<R, Error>
    }
    return Effect.fail(new Error(`Unknown control ${intent._tag}`))
  },
}))

describe("IOECC 端到端", () => {
  test("天气 agent 完整运行：静态触发 → E → 动态 C → O", async () => {
    const run = Effect.gen(function* () {
      const ctl = yield* ControlExecutor
      const trigger = reportAgent.controls[0]!
      const report = yield* ctl.control(trigger)
      return report
    })
    const out = await Effect.runPromise(
      run.pipe(Effect.provide(weatherService), Effect.provide(harness))
    )
    expect(out).toBe("Report: Sunny Shanghai")
  })

  test("E 被路由到 Connection，动态 C 也执行（都在一次运行内发生）", async () => {
    // 通过可观测副作用验证：跑一次 agent，E 和 C 都发生了。
    const executed: string[] = []
    const loggingConn = Layer.effect(EffectExecutor, Effect.succeed({
      execute: <P, R>(intent: EffectIntent<P, R>) => {
        executed.push(`E:${intent._tag}`)
        return Effect.succeed("Sunny") as unknown as Effect.Effect<R, Error>
      },
    }))
    const loggingCtl = Layer.effect(ControlExecutor, Effect.succeed({
      control: <P, R>(intent: ControlIntent<P, R>) => {
        executed.push(`C:${intent._tag}`)
        if (intent._tag === "OnInput") {
          return (intent as unknown as OnInput<unknown, unknown>).handle(undefined) as unknown as Effect.Effect<R, Error>
        }
        return Effect.succeed("ok") as unknown as Effect.Effect<R, Error>
      },
    }))

    await Effect.runPromise(
      Effect.gen(function* () {
        const ctl = yield* ControlExecutor
        yield* ctl.control(reportAgent.controls[0]!)
      }).pipe(Effect.provide(loggingConn), Effect.provide(loggingCtl))
    )

    // 一次运行内：静态触发 OnInput、E(FetchWeather)、动态 C(ForkArchiver) 都发生了。
    expect(executed).toContain("C:OnInput")
    expect(executed).toContain("E:FetchWeather")
    expect(executed).toContain("C:ForkArchiver")
  })
})
