import { describe, expect, test } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import {
  Agent,
  Control,
  ControlExecutor,
  Effect as EffectDecl,
  EffectExecutor,
} from "../src/index.js"

/**
 * 用「天气记录 Agent」（IOECC 例子）验证概念表达力：
 * 多个 E 各自声明目标 Connection，Agent 声明 effects（影响哪些 Connection）。
 */

/* ── 静态 Trigger：OnInput（一个 Control，携带触发后的行为） ── */
class OnInput<I, O, R = never> implements Control<I, O> {
  readonly _tag = "OnInput"
  constructor(
    readonly input: Schema.Schema<I>,
    readonly output: Schema.Schema<O>,
    readonly handle: (input: I) => Effect.Effect<O, Error, R>
  ) {}
}

/* ── E：三个，各自声明目标 Connection ── */

/** 查天气 → WeatherApp。 */
class FetchWeather implements EffectDecl<"WeatherApp", { city: string }, string> {
  readonly _tag = "FetchWeather"
  readonly connection = "WeatherApp"
  readonly input = Schema.Struct({ city: Schema.String })
  readonly output = Schema.String
}

/** 记录日志 → Logs。 */
class LogInfo implements EffectDecl<"Logs", { msg: string }, void> {
  readonly _tag = "LogInfo"
  readonly connection = "Logs"
  readonly input = Schema.Struct({ msg: Schema.String })
  readonly output = Schema.Void
}

/** 写文件 → Filesystem。 */
class WriteFile implements EffectDecl<"Filesystem", { path: string; data: string }, void> {
  readonly _tag = "WriteFile"
  readonly connection = "Filesystem"
  readonly input = Schema.Struct({ path: Schema.String, data: Schema.String })
  readonly output = Schema.Void
}

/* ── 路由 executor：按 E.connection 把 Effect 路由到对应 Connection ── */

const routingExecutor = Layer.effect(EffectExecutor, Effect.succeed({
  execute: (effect: EffectDecl<any, any, any>) => {
    switch (effect.connection) {
      case "WeatherApp":
        return Effect.succeed("Sunny")
      case "Logs":
        return Effect.succeed(undefined)
      case "Filesystem":
        return Effect.succeed(undefined)
      default:
        return Effect.fail(new Error(`Unknown connection ${effect.connection}`))
    }
  },
}))

/* ── 天气记录 Agent：声明 effects（影响哪些 Connection）+ controls ── */

const weatherLogger: Agent = {
  effects: [new FetchWeather(), new LogInfo(), new WriteFile()],
  controls: [
    new OnInput(
      Schema.Struct({ city: Schema.String }),
      Schema.Void,
      () => Effect.gen(function* () {
        const exec = yield* EffectExecutor
        yield* exec.execute(new FetchWeather())
        yield* exec.execute(new LogInfo())
        yield* exec.execute(new WriteFile())
        return undefined
      })
    ),
  ],
}

describe("IOECC 概念表达力", () => {
  test("Agent.effects 声明影响哪些 Connection，外部可读", () => {
    const affected = weatherLogger.effects.map((e) => e.connection)
    expect(affected).toContain("WeatherApp")
    expect(affected).toContain("Logs")
    expect(affected).toContain("Filesystem")
  })

  test("路由 executor 按 connection 分发 E", async () => {
    const run = Effect.gen(function* () {
      const exec = yield* EffectExecutor
      yield* exec.execute(new FetchWeather())
      yield* exec.execute(new LogInfo())
      yield* exec.execute(new WriteFile())
      return "done"
    })
    const out = await Effect.runPromise(run.pipe(Effect.provide(routingExecutor)))
    expect(out).toBe("done")
  })

  test("完整流程：静态触发 → 三个 E 各路由到对应 Connection", async () => {
    const hit: string[] = []
    const loggingExec = Layer.effect(EffectExecutor, Effect.succeed({
      execute: (effect: EffectDecl<any, any, any>) => {
        hit.push(effect.connection)
        return Effect.succeed(effect._tag === "FetchWeather" ? "Sunny" : undefined)
      },
    }))
    const ctlImpl = Layer.effect(ControlExecutor, Effect.succeed({
      control: (control: Control<any, any>) => {
        if (control._tag === "OnInput") {
          return (control as unknown as OnInput<unknown, unknown>).handle(undefined) as unknown as Effect.Effect<unknown, Error>
        }
        return Effect.fail(new Error(`Unknown ${control._tag}`))
      },
    }))

    await Effect.runPromise(
      Effect.gen(function* () {
        const ctl = yield* ControlExecutor
        yield* ctl.control(weatherLogger.controls[0]!)
      }).pipe(Effect.provide(loggingExec), Effect.provide(ctlImpl))
    )

    expect(hit).toContain("WeatherApp")
    expect(hit).toContain("Logs")
    expect(hit).toContain("Filesystem")
  })
})
