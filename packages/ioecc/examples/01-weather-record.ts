import { Effect, Schema } from "effect"
import { ConnectionImpl, Driver, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 1 —— 天气记录 Agent（五维度作入参，gen 就是 compile）。
 *
 * 五维度（input/output/effects/connections/controls）+ driver 直接作为 gen 入参，
 * 不再 yield 描述操作；function* 只在需要自定义触发逻辑时用。
 *
 * 运行：bun packages/ioecc/examples/01-weather-record.ts
 */

/* ── E：只声明哪个 Connection 受影响 ── */
const fetchWeather = { _tag: "FetchWeather", connection: "WeatherApp" } as const
const logInfo = { _tag: "LogInfo", connection: "Logs" } as const
const writeFile = { _tag: "WriteFile", connection: "Filesystem" } as const

/* ── Driver：能跑这个 agent 的执行者 ── */
const driver: Driver = {
  id: "fake-driver",
  run: (input) => Effect.succeed(input),
}

/* ── Connections 实现（操作契约在编译侧） ── */
const impls = new Map<string, ConnectionImpl>([
  ["WeatherApp", { handle: () => Effect.succeed("Sunny") }],
  ["Logs", { handle: () => Effect.succeed(undefined) }],
  ["Filesystem", { handle: () => Effect.succeed(undefined) }],
])

/* ── gen：五维度 + driver 作入参，直接产出可运行程序 ── */
const program = EffectAgent.gen({
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.Void,
  effects: [fetchWeather, logInfo, writeFile],
  connections: [{ name: "WeatherApp" }, { name: "Logs" }, { name: "Filesystem" }],
  controls: [{ _tag: "OnInput" }],
}, driver, impls)

/* ── 跑：先看描述，再执行 ── */
console.log("=== 天气记录 Agent 描述 ===")
console.log(JSON.stringify(program.agent, null, 2))

console.log("\n=== 执行 ===")
const out = await Effect.runPromise(program.execute(fetchWeather))
console.log("查询天气 →", out)
