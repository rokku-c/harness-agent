import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 4 —— 黑板架构。
 *
 * 多个 agent 共享一个黑板 Connection：每个 agent 用 Control 声明对黑板的读写影响（affects），
 * 不直接调用彼此。黑板是共享世界，协作由 Connection 长出。
 * I/O + 影响声明绑定在 Control 上：Write/Read 自带 I/O，都声明影响 Blackboard。
 *
 * 运行：bun packages/ioecc/examples/04-blackboard.ts
 */

/* ── 黑板 Connection 实现（共享内存） ── */
const board: { entries: string[] } = { entries: [] }
const boardImpl: ConnectionImpl = {
  handle: (op, args) => {
    if (op === "write") return Effect.sync(() => { board.entries.push(`entry-${String(args)}`); return board.entries.length })
    if (op === "read") return Effect.sync(() => [...board.entries].join("\n") as unknown)
    return Effect.fail(new Error(`Blackboard can't ${op}`))
  },
}

/* ── 一个 Control：自带 I/O + 声明影响 Blackboard + run 经 impls 读写 ── */
class Write extends Control<string, number> {
  readonly input = Schema.String
  readonly output = Schema.Number
  constructor() { super("Write", ["Blackboard"]) }
  run(i: string, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<number, Error> {
    const blackboard = impls.get("Blackboard")!
    return blackboard.handle("write", i) as Effect.Effect<number, Error>
  }
}

class Read extends Control<void, string> {
  readonly input = Schema.Void
  readonly output = Schema.String
  constructor() { super("Read", ["Blackboard"]) }
  run(_i: void, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<string, Error> {
    const blackboard = impls.get("Blackboard")!
    return blackboard.handle("read", _i) as Effect.Effect<string, Error>
  }
}

/* ── 两个 agent：各带一个 control，共享黑板 ── */

/** agent A：写黑板（producer）。 */
const agentA = EffectAgent.gen({
  connections: ["Blackboard"],
  controls: [new Write()],
}, [], new Map([["Blackboard", boardImpl]]))

/** agent B：读黑板（consumer）。 */
const agentB = EffectAgent.gen({
  connections: ["Blackboard"],
  controls: [new Read()],
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
