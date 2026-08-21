import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 2 —— Advisor 架构（Control 子类形态）。
 *
 * 主 agent 在关键决策点咨询顾问。顾问是另一个 Control（Consult），
 * 都经 Advisor Connection 交互。子类形态适合较复杂逻辑。
 *
 * 运行：bun packages/ioecc/examples/02-advisor.ts
 */

/* ── 主 agent 的 Control：Decide —— 咨询顾问后做决定 ── */
class Decide extends Control<{ task: string }, { verdict: string; reason: string }> {
  readonly input = Schema.Struct({ task: Schema.String })
  readonly output = Schema.Struct({ verdict: Schema.String, reason: Schema.String })
  constructor() { super("Decide", ["Advisor"]) }
  run(i: { task: string }, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<{ verdict: string; reason: string }, Error> {
    return impls.get("Advisor")!.handle("consult", i.task) as Effect.Effect<{ verdict: string; reason: string }, Error>
  }
}

/* ── 顾问 Connection 实现：Consult 给建议 ── */
const advisorImpl: ConnectionImpl = {
  handle: (op, args) => Effect.succeed({ verdict: "approve", reason: `advice on: ${String(args)}` }),
}

const program = EffectAgent.gen({
  connections: ["Advisor"],
  controls: [new Decide()],
}, [], new Map([["Advisor", advisorImpl]]))

console.log("=== Advisor 架构 ===")
console.log("Decide 影响:", program.agent.controls[0]!.affects.join(", "))

const out = await Effect.runPromise(program.drive(0, { task: "refactor auth" })) as { verdict: string; reason: string }
console.log("主 agent 决定:", out.verdict, "—", out.reason)
