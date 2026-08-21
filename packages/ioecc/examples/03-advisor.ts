import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, Driver, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 3 —— Advisor 架构。
 *
 * 主 agent 在关键决策点咨询顾问（更强的模型/agent）。顾问是一个 Agent（可当 driver），
 * 主 agent 通过一个 consult Connection 声明咨询请求，运行时路由到顾问。
 *
 * 运行：bun packages/ioecc/examples/03-advisor.ts
 */

/* ── E：主 agent 声明咨询请求（对 Advisor Connection） ── */
const consult = { _tag: "Consult", connection: "Advisor" } as const

/* ── 顾问 driver：一个 Agent，run = 顾问逻辑 ── */
const advisor = {
  input: Schema.Struct({ question: Schema.String }),
  output: Schema.Struct({ verdict: Schema.String, reason: Schema.String }),
  effects: [],
  connections: [],
  controls: [],
  drivers: [],
  // 具体 driver 能力：顾问给建议。
  run: (input: { question: string }) => Effect.succeed({ verdict: "approve", reason: `advice on: ${input.question}` }),
}

/* ── 主 agent 的控制：Decide —— 咨询顾问后做决定 ── */
class Decide extends Control<{ task: string }, { verdict: string; reason: string }> {
  constructor() { super("Decide") }
  run(_i: { task: string }, _o: { verdict: string; reason: string }, _e: ReadonlyArray<any>, _cn: ReadonlyArray<any>, _ct: ReadonlyArray<any>, d: Driver): Effect.Effect<{ verdict: string; reason: string }, Error> {
    // d 是主 agent 的 driver（这里用顾问 driver），consult 通过 Advisor Connection 路由。
    const concrete = d as unknown as { run: (i: { question: string }) => Effect.Effect<{ verdict: string; reason: string }, Error> }
    return concrete.run({ question: `should I ${_i.task}?` })
  }
}

/* ── gen：主 agent，advisor 作为 driver ── */
const program = EffectAgent.gen({
  input: Schema.Struct({ task: Schema.String }),
  output: Schema.Struct({ verdict: Schema.String, reason: Schema.String }),
  effects: [consult],
  connections: [{ name: "Advisor" }],
  controls: [new Decide()],
}, [advisor])

console.log("=== Advisor 架构 ===")
console.log("主 agent 影响:", program.agent.effects.map((e) => e.connection).join(", "))
console.log("advisor 作为 driver，connections:", program.agent.drivers.length)

const out = await Effect.runPromise(program.drive(0, { task: "refactor auth module" })) as { verdict: string; reason: string }
console.log("\n=== 主 agent 决定 ===")
console.log("verdict:", out.verdict)
console.log("reason:", out.reason)
