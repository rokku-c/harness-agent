import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 9 —— 最小 Agent。
 *
 * 一个最小 Agent：Control 自带 I/O，声明影响一个 connection，经 impls 访问世界。
 * Agent 无全局 I/O，只声明 connections + controls；驱动 = drive(index, input)。
 * 展示新模型的最小骨架。
 *
 * 运行：bun packages/ioecc/examples/09-simplest-agent.ts
 */

/* ── 一个最小 Control：自带 I/O + 声明影响 + run 经 impls 访问连接 ── */
class Echo extends Control<string, string> {
  readonly input = Schema.String
  readonly output = Schema.String
  constructor() { super("Echo", ["World"]) }
  run(i: string, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<string, Error> {
    const world = impls.get("World")!
    return world.handle("echo", i) as Effect.Effect<string, Error>
  }
}

/* ── World 连接实现（fake） ── */
const impls = new Map<string, ConnectionImpl>([
  ["World", { handle: (op, args) => Effect.succeed(`${op}:${String(args)}`) }],
])

/* ── gen：Agent 无全局 I/O，只有 connections + controls ── */
const program = EffectAgent.gen({
  connections: ["World"],
  controls: [new Echo()],
}, [], impls)

console.log("=== 最小 Agent ===")
console.log("Control 声明影响:", program.agent.controls[0]!.affects.join(", "))

const out = await Effect.runPromise(program.drive(0, "hi")) as string
console.log("\n=== 执行（Echo 经 impls 访问 World） ===")
console.log(out)
