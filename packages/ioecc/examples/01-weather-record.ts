import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 1 —— 天气记录 Agent。
 *
 * 影响声明绑定在 Control 上（affects）：RunLogic 声明影响 WeatherApp/Logs/Filesystem。
 * run 经 impls（affects 声明的 connection 实现）访问这些世界。
 * 驱动 = 执行 control。
 *
 * 运行：bun packages/ioecc/examples/01-weather-record.ts
 */

/* ── 一个 Control：声明影响哪些 connection + run 逻辑 ── */
class RunLogic<I, O> extends Control<I, O> {
  constructor() { super("RunLogic", ["WeatherApp", "Logs", "Filesystem"]) }
  run(_i: I, _o: O, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error> {
    const weather = impls.get("WeatherApp")!
    const logs = impls.get("Logs")!
    return Effect.gen(function* () {
      const w = yield* weather.handle("get", _i)
      yield* logs.handle("info", `fetched ${String(w)}`)
      return w as O
    })
  }
}

/* ── Connections 实现（操作契约在编译侧） ── */
const impls = new Map<string, ConnectionImpl>([
  ["WeatherApp", { handle: (op, args) => Effect.succeed(`Sunny ${String(args)}`) }],
  ["Logs", { handle: () => Effect.succeed(undefined) }],
  ["Filesystem", { handle: () => Effect.succeed(undefined) }],
])

/* ── gen：五维度 + Control（影响声明在其上） ── */
const program = EffectAgent.gen({
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.String,
  connections: ["WeatherApp", "Logs", "Filesystem"],
  controls: [new RunLogic<{ city: string }, string>()],
}, [], impls)

console.log("=== 天气记录 Agent ===")
console.log("Control 声明影响:", program.agent.controls[0]!.affects.join(", "))

const out = await Effect.runPromise(program.drive(0, { city: "Shanghai" }))
console.log("\n=== 执行（control 经 impls 访问影响的世界） ===")
console.log("查询天气 →", out)
