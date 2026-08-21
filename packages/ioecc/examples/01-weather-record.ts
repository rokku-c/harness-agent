import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, Driver, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 1 —— 天气记录 Agent。
 *
 * driver 就是 Agent（五维度），声明自己的 control（能力）；gen 注入 drivers，
 * 驱动靠 driver 声明的 control。connections 注入 Effect 实现。
 *
 * 运行：bun packages/ioecc/examples/01-weather-record.ts
 */

/* ── E：只声明哪个 Connection 受影响 ── */
const fetchWeather = { _tag: "FetchWeather", connection: "WeatherApp" } as const
const logInfo = { _tag: "LogInfo", connection: "Logs" } as const
const writeFile = { _tag: "WriteFile", connection: "Filesystem" } as const

/* ── 一个 Control 实现：用 driver 能力写逻辑 ── */
class RunLogic<I, O> extends Control<I, O> {
  constructor() { super("RunLogic") }
  run(_i: I, _o: O, _e: ReadonlyArray<any>, _cn: ReadonlyArray<any>, _ct: ReadonlyArray<any>, d: Driver): Effect.Effect<O, Error> {
    const concrete = d as unknown as { run: (i: I) => Effect.Effect<O, Error> }
    return concrete.run(_i)
  }
}

/* ── driver：是 Agent（五维度），声明自己的 control + 具体 run 方法 ── */
const driver = {
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.String,
  effects: [],
  connections: [],
  controls: [new RunLogic<{ city: string }, string>()],
  drivers: [],
  run: (input: { city: string }) => Effect.succeed(`Sunny in ${input.city}`),
}

/* ── Connections 实现（操作契约在编译侧） ── */
const impls = new Map<string, ConnectionImpl>([
  ["WeatherApp", { handle: () => Effect.succeed("Sunny") }],
  ["Logs", { handle: () => Effect.succeed(undefined) }],
  ["Filesystem", { handle: () => Effect.succeed(undefined) }],
])

/* ── gen：五维度 + drivers（n 个）作入参，直接产出可运行程序 ── */
const program = EffectAgent.gen({
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.Void,
  effects: [fetchWeather, logInfo, writeFile],
  connections: [{ name: "WeatherApp" }, { name: "Logs" }, { name: "Filesystem" }],
  controls: [], // 控制由 driver 声明（RunLogic）
}, [driver], impls)

/* ── 跑：先看描述，再执行 ── */
console.log("=== 天气记录 Agent 描述 ===")
console.log(JSON.stringify(program.agent, null, 2))

console.log("\n=== 执行（driver 声明的 control） ===")
const out = await Effect.runPromise(program.drive(0, { city: "Shanghai" }))
console.log("查询天气 →", out)
