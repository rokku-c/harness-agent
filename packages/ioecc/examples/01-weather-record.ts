import { Effect, Schema } from "effect"
import {
  ConnectionImpl,
  EffectAgent,
  compile,
} from "../src/index.js"

/**
 * IOECC 示例 1 —— 天气记录 Agent（effect-ts style）。
 *
 * 用 `EffectAgent.gen` 声明式描述 agent：yield 五维度（input/output/effects/
 * connections/controls），收集成纯描述。compile 时才提供执行契约。
 *
 * 运行：bun packages/ioecc/examples/01-weather-record.ts
 */

/* ── E：只声明哪个 Connection 受影响 ── */
const fetchWeather = { _tag: "FetchWeather", connection: "WeatherApp" } as const
const logInfo = { _tag: "LogInfo", connection: "Logs" } as const
const writeFile = { _tag: "WriteFile", connection: "Filesystem" } as const

/* ── Agent：用 gen 声明五维度，收集成纯描述 ── */
const weatherLogger = EffectAgent.gen(function* () {
  yield EffectAgent.input(Schema.Struct({ city: Schema.String }))
  yield EffectAgent.output(Schema.Void)
  yield EffectAgent.effect(fetchWeather)
  yield EffectAgent.effect(logInfo)
  yield EffectAgent.effect(writeFile)
  yield EffectAgent.connection({ name: "WeatherApp" })
  yield EffectAgent.connection({ name: "Logs" })
  yield EffectAgent.connection({ name: "Filesystem" })
  yield EffectAgent.control({ _tag: "OnInput" })
})

/* ── compile：注入 Driver + Connection 实现（操作契约在编译侧） ── */
const driver = { id: "fake-driver", run: (input: unknown) => Effect.succeed(input) }
const impls = new Map<string, ConnectionImpl>([
  ["WeatherApp", { handle: (e) => Effect.succeed(`Sunny in ${(e as typeof fetchWeather).connection}`) }],
  ["Logs", { handle: () => Effect.succeed(undefined) }],
  ["Filesystem", { handle: () => Effect.succeed(undefined) }],
])
const program = compile(weatherLogger, { driver, connections: impls })

/* ── 跑：先看描述，再执行 ── */
console.log("=== 天气记录 Agent 描述（gen 收集） ===")
console.log(JSON.stringify(weatherLogger, null, 2))

console.log("\n=== 执行 ===")
const out = await Effect.runPromise(program.execute(fetchWeather))
console.log("查询天气 →", out)
