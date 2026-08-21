import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 1 —— 天气记录 Agent。
 *
 * I/O 定义在 Control 上：RunLogic 自带 input（city）/ output（string）。
 * 影响声明绑定在 Control 上（affects）：RunLogic 声明影响 WeatherApp/Logs/Filesystem。
 * run 经 impls（affects 声明的 connection 实现）访问这些世界。
 * Agent 无全局 I/O，只声明 connections + controls；驱动 = drive(index, input)。
 *
 * 运行：bun packages/ioecc/examples/01-weather-record.ts
 */

/* ── 一个 Control：自带 I/O + 声明影响哪些 connection + run 逻辑 ── */
class RunLogic extends Control<{ city: string }, string> {
  readonly input = Schema.Struct({ city: Schema.String })
  readonly output = Schema.String
  constructor() { super("RunLogic", ["WeatherApp", "Logs", "Filesystem"]) }
  run(i: { city: string }, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<string, Error> {
    const weather = impls.get("WeatherApp")!
    const logs = impls.get("Logs")!
    return Effect.gen(function* () {
      const w = yield* weather.handle("get", i.city) as Effect.Effect<string, Error>
      yield* logs.handle("info", `fetched ${String(w)}`)
      return w
    })
  }
}

/* ── Connections 实现（操作契约在编译侧） ── */
const impls = new Map<string, ConnectionImpl>([
  ["WeatherApp", { handle: (op, args) => Effect.succeed(`Sunny ${String(args)}`) }],
  ["Logs", { handle: () => Effect.succeed(undefined as unknown) }],
  ["Filesystem", { handle: () => Effect.succeed(undefined as unknown) }],
])

/* ── gen：Agent 无全局 I/O，只声明 connections + controls ── */
const program = EffectAgent.gen({
  connections: ["WeatherApp", "Logs", "Filesystem"],
  controls: [new RunLogic()],
}, [], impls)

console.log("=== 天气记录 Agent ===")
console.log("Control 声明影响:", program.agent.controls[0]!.affects.join(", "))

const out = await Effect.runPromise(program.drive(0, { city: "Shanghai" })) as string
console.log("\n=== 执行（control 经 impls 访问影响的世界） ===")
console.log("查询天气 →", out)
