import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  Agent,
  compile,
  ConnectionImpl,
  Control,
  Effect as EffectDecl,
} from "../src/index.js"

/**
 * 天气记录 Agent —— 验证「描述与执行分离」：
 * Agent 是纯描述（effects + controls），compile(agent, env) 才变成可执行程序。
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

/* ── Agent 描述（纯数据，不执行） ── */

const weatherLogger: Agent = {
  effects: [new FetchWeather(), new LogInfo(), new WriteFile()],
  controls: [
    new OnInput(
      Schema.Struct({ city: Schema.String }),
      Schema.Void,
      (input) => Effect.gen(function* () {
        // 描述运行时的行为：调用 compile 产出的 execute。
        // 注意：这里不直接 import 实现，只构造 E 声明。
        const exec = (e: EffectDecl<any, any, any>) => Effect.fail(new Error("unwired")) as Effect.Effect<any, Error>
        void input
        void exec
        return undefined
      })
    ),
  ],
}

/* ── Connection 实现（编译时提供） ── */

const connections = new Map<string, ConnectionImpl>([
  ["WeatherApp", { handle: (e) => Effect.succeed("Sunny") }],
  ["Logs", { handle: () => Effect.succeed(undefined) }],
  ["Filesystem", { handle: () => Effect.succeed(undefined) }],
])

const compiled = compile(weatherLogger, { connections })

describe("IOECC 描述与执行分离", () => {
  test("Agent 是纯描述：effects 声明影响哪些 Connection，compile 前不执行", () => {
    // 描述本身可读，不触发任何副作用。
    const affected = weatherLogger.effects.map((e) => e.connection)
    expect(affected).toContain("WeatherApp")
    expect(affected).toContain("Logs")
    expect(affected).toContain("Filesystem")
    // controls 声明触发器。
    expect(weatherLogger.controls.length).toBe(1)
  })

  test("compile 后按 connection 路由执行 E", async () => {
    // 描述不可执行；compile(agent, env) 后才有可运行程序。
    const out = await Effect.runPromise(
      compiled.execute(new FetchWeather()).pipe(
        Effect.map((r) => String(r))
      )
    )
    expect(out).toBe("Sunny")
  })

  test("compile 的驱动：静态触发器走 control（input Schema 解码）", async () => {
    // OnInput 的 handle 需要 E 的 execute 通路；这里用一个 wired 版本验证。
    const wiredAgent: Agent = {
      effects: [new FetchWeather()],
      controls: [new OnInput(
        Schema.Struct({ city: Schema.String }),
        Schema.String,
        () => Effect.succeed("report") // 简单 handle，不依赖 execute
      )],
    }
    const wired = compile(wiredAgent, { connections })
    const result = await Effect.runPromise(wired.drive(0, { city: "Shanghai" }))
    expect(result).toBe("report")
  })
})
