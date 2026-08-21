import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 3 —— 黑板架构。
 *
 * 多个 agent 共享一个黑板 Connection。每个 control 声明影响 Blackboard，
 * 读写的都是同一块共享内存。协作由 Connection 长出。
 *
 * 运行：bun packages/ioecc/examples/03-blackboard.ts
 */

/* ── 黑板 Connection 实现（共享内存） ── */
const board: string[] = []
const boardImpl: ConnectionImpl = {
  handle: (op, args) => {
    if (op === "write") { board.push(String(args)); return Effect.succeed(board.length) }
    if (op === "read") return Effect.succeed([...board].join("\n"))
    return Effect.fail(new Error(`Blackboard can't ${op}`))
  },
}

/* ── Agent A：写黑板（Control） ── */
const writer = EffectAgent.gen({
  connections: ["Blackboard"],
  controls: [new (class extends Control<string, number> {
    readonly input = Schema.String
    readonly output = Schema.Number
    constructor() { super("Write", ["Blackboard"]) }
    run(i: string, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<number, Error> {
      return impls.get("Blackboard")!.handle("write", i) as Effect.Effect<number, Error>
    }
  })()],
}, [], new Map([["Blackboard", boardImpl]]))

/* ── Agent B：读黑板（Control） ── */
const reader = EffectAgent.gen({
  connections: ["Blackboard"],
  controls: [new (class extends Control<void, string> {
    readonly input = Schema.Void
    readonly output = Schema.String
    constructor() { super("Read", ["Blackboard"]) }
    run(_i: void, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<string, Error> {
      return impls.get("Blackboard")!.handle("read", undefined) as Effect.Effect<string, Error>
    }
  })()],
}, [], new Map([["Blackboard", boardImpl]]))

console.log("=== 黑板架构 ===")
await Effect.runPromise(writer.drive(0, "alpha"))
await Effect.runPromise(writer.drive(0, "beta"))
const read = await Effect.runPromise(reader.drive(0, undefined)) as string
console.log("A 写入 2 条，B 读到:\n" + read)
