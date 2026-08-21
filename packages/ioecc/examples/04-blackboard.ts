import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, Driver, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 4 —— 黑板架构。
 *
 * 多个 agent 共享一个黑板 Connection：每个 agent 声明对黑板的 effects（read/write），
 * 不直接调用彼此。黑板是共享世界，协作由 Connection 长出。
 *
 * 运行：bun packages/ioecc/examples/04-blackboard.ts
 */

/* ── E：对黑板 Connection 的读写 ── */
const writeBoard = { _tag: "BoardWrite", connection: "Blackboard" } as const
const readBoard = { _tag: "BoardRead", connection: "Blackboard" } as const

/* ── 黑板 Connection 实现（共享内存） ── */
const board: { entries: string[] } = { entries: [] }
const boardImpl: ConnectionImpl = {
  handle: (e) => {
    if (e._tag === "BoardWrite") return Effect.sync(() => { board.entries.push(`entry-${board.entries.length}`); return board.entries.length })
    if (e._tag === "BoardRead") return Effect.sync(() => [...board.entries].join("\n"))
    return Effect.fail(new Error(`Blackboard can't ${e._tag}`))
  },
}

/* ── 一个 Control：经具体 driver 的 run 驱动 ── */
class RunLogic<I, O> extends Control<I, O> {
  constructor() { super("RunLogic") }
  run(_i: I, _o: O, _e: ReadonlyArray<any>, _cn: ReadonlyArray<any>, _ct: ReadonlyArray<any>, d: Driver): Effect.Effect<O, Error> {
    const concrete = d as unknown as { run: (i: I) => Effect.Effect<O, Error> }
    return concrete.run(_i)
  }
}

/* ── 两个 agent：各带一个 driver，共享黑板 ── */

/** agent A：写黑板（producer）。 */
const agentA = EffectAgent.gen({
  input: Schema.Void,
  output: Schema.Number,
  effects: [writeBoard],
  connections: [{ name: "Blackboard" }],
  controls: [new RunLogic<void, number>()],
}, [{
  input: Schema.Void, output: Schema.Number, effects: [], connections: [], controls: [], drivers: [],
  run: () => Effect.succeed(1),
}], new Map([["Blackboard", boardImpl]]))

/** agent B：读黑板（consumer）。 */
const agentB = EffectAgent.gen({
  input: Schema.Void,
  output: Schema.String,
  effects: [readBoard],
  connections: [{ name: "Blackboard" }],
  controls: [new RunLogic<void, string>()],
}, [{
  input: Schema.Void, output: Schema.String, effects: [], connections: [], controls: [], drivers: [],
  run: () => Effect.succeed(board.entries.join("\n")),
}], new Map([["Blackboard", boardImpl]]))

console.log("=== 黑板架构 ===")
console.log("Agent A 影响:", agentA.agent.effects.map((e) => e.connection).join(", "))
console.log("Agent B 影响:", agentB.agent.effects.map((e) => e.connection).join(", "))
console.log("共享 Connection:", agentA.agent.connections[0]!.name, "=", agentB.agent.connections[0]!.name)

// A 写黑板，B 读黑板（经共享 Connection）。
const written = await Effect.runPromise(agentA.execute(writeBoard))
await Effect.runPromise(agentA.execute(writeBoard))
const read = await Effect.runPromise(agentB.execute(readBoard))

console.log("\n=== 协作 ===")
console.log("A 写入 → 黑板条目数:", written)
console.log("B 读到黑板:\n", read)
