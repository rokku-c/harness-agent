import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 4 —— 黑板架构。
 *
 * 多个 agent 共享一个黑板 Connection：每个 agent 用 Control 声明对黑板的读写影响（affects），
 * 不直接调用彼此。黑板是共享世界，协作由 Connection 长出。
 *
 * 运行：bun packages/ioecc/examples/04-blackboard.ts
 */

/* ── 黑板 Connection 实现（共享内存） ── */
const board: { entries: string[] } = { entries: [] }
const boardImpl: ConnectionImpl = {
  handle: (op, args) => {
    if (op === "write") return Effect.sync(() => { board.entries.push(`entry-${String(args)}`); return board.entries.length })
    if (op === "read") return Effect.sync(() => [...board.entries].join("\n"))
    return Effect.fail(new Error(`Blackboard can't ${op}`))
  },
}

/* ── 一个 Control：声明影响 Blackboard + run 经 impls 读写 ── */
class Write<I, O> extends Control<I, O> {
  constructor() { super("Write", ["Blackboard"]) }
  run(_i: I, _o: O, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error> {
    const blackboard = impls.get("Blackboard")!
    return blackboard.handle("write", _i) as Effect.Effect<O, Error>
  }
}

class Read<I, O> extends Control<I, O> {
  constructor() { super("Read", ["Blackboard"]) }
  run(_i: I, _o: O, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<O, Error> {
    const blackboard = impls.get("Blackboard")!
    return blackboard.handle("read", _i) as Effect.Effect<O, Error>
  }
}

/* ── 两个 agent：各带一个 control，共享黑板 ── */

/** agent A：写黑板（producer）。 */
const agentA = EffectAgent.gen({
  input: Schema.String,
  output: Schema.Number,
  connections: ["Blackboard"],
  controls: [new Write<string, number>()],
}, [], new Map([["Blackboard", boardImpl]]))

/** agent B：读黑板（consumer）。 */
const agentB = EffectAgent.gen({
  input: Schema.Void,
  output: Schema.String,
  connections: ["Blackboard"],
  controls: [new Read<void, string>()],
}, [], new Map([["Blackboard", boardImpl]]))

console.log("=== 黑板架构 ===")
console.log("Agent A 影响:", agentA.agent.controls[0]!.affects.join(", "))
console.log("Agent B 影响:", agentB.agent.controls[0]!.affects.join(", "))
console.log("共享 Connection:", agentA.agent.connections[0], "=", agentB.agent.connections[0])

// A 写黑板，B 读黑板（经共享 Connection）。
const written = await Effect.runPromise(agentA.drive(0, "alpha")) as number
await Effect.runPromise(agentA.drive(0, "beta")) as number
const read = await Effect.runPromise(agentB.drive(0, undefined)) as string

console.log("\n=== 协作（各 control 经 impls 访问共享黑板） ===")
console.log("A 写入 → 黑板条目数:", written)
console.log("B 读到黑板:\n", read)
