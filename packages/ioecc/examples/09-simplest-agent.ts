import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 9 —— 最小 Agent。
 *
 * 一个最小 Agent：单维度声明（input/output），一个 control 声明影响一个 connection，
 * 经 impls 访问世界。展示新模型的最小骨架。
 * 影响声明绑定在 Control 上（affects）：Echo 声明影响 World。
 *
 * 运行：bun packages/ioecc/examples/09-simplest-agent.ts
 */

/* ── 一个最小 Control：声明影响 + run 经 impls 访问连接 ── */
class Echo<I, O> extends Control<I, O> {
  constructor() { super("Echo", ["World"]) }
  run(_i: I, _o: O, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error> {
    const world = impls.get("World")!
    return world.handle("echo", _i) as Effect.Effect<O, Error>
  }
}

/* ── World 连接实现（fake） ── */
const impls = new Map<string, ConnectionImpl>([
  ["World", { handle: (op, args) => Effect.succeed(`${op}:${String(args)}`) }],
])

/* ── gen：最小五维度 + 一个 control ── */
const program = EffectAgent.gen({
  input: Schema.String,
  output: Schema.String,
  connections: ["World"],
  controls: [new Echo<string, string>()],
}, [], impls)

console.log("=== 最小 Agent ===")
console.log("Control 声明影响:", program.agent.controls[0]!.affects.join(", "))

const out = await Effect.runPromise(program.drive(0, "hi")) as string
console.log("\n=== 执行（Echo 经 impls 访问 World） ===")
console.log(out)
