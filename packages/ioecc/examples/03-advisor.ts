import { Effect, Schema } from "effect"
import { ConnectionImpl, Control, EffectAgent } from "../src/index.js"

/**
 * IOECC 示例 3 —— Advisor 架构。
 *
 * 主 agent 在关键决策点咨询顾问（更强的模型/agent）。顾问是一个 Agent（可当 driver），
 * 主 agent 通过一个 consult —— 声明影响 Advisor Connection，运行时经 impls 路由到顾问。
 * I/O + 影响声明绑定在 Control 上：Consult/Decide 自带 I/O，都声明影响 Advisor。
 *
 * 运行：bun packages/ioecc/examples/03-advisor.ts
 */

type Advice = { verdict: string; reason: string }

/* ── 顾问 driver：一个 Agent（connections + controls），Consult control 自带 I/O、声明影响 Advisor ── */
class Consult extends Control<{ question: string }, Advice> {
  readonly input = Schema.Struct({ question: Schema.String })
  readonly output = Schema.Struct({ verdict: Schema.String, reason: Schema.String })
  constructor() { super("Consult", ["Advisor"]) }
  run(i: { question: string }, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<Advice, Error> {
    const advisor = impls.get("Advisor")!
    return advisor.handle("consult", i) as Effect.Effect<Advice, Error>
  }
}

/* ── 顾问实际逻辑：注入为 Advisor ConnectionImpl ── */
const advisorImpl: ConnectionImpl = {
  handle: (_op, args) => {
    const q = (args as { question: string }).question
    return Effect.succeed({ verdict: "approve", reason: `advice on: ${q}` })
  },
}

const advisorDriver = {
  connections: ["Advisor"],
  controls: [new Consult()],
  drivers: [],
}

/* ── 主 agent 的控制：Decide —— 咨询顾问后做决定（自带 I/O，声明影响 Advisor） ── */
class Decide extends Control<{ task: string }, Advice> {
  readonly input = Schema.Struct({ task: Schema.String })
  readonly output = Schema.Struct({ verdict: Schema.String, reason: Schema.String })
  constructor() { super("Decide", ["Advisor"]) }
  run(i: { task: string }, impls: ReadonlyMap<string, ConnectionImpl>): Effect.Effect<Advice, Error> {
    const advisor = impls.get("Advisor")!
    return advisor.handle("consult", { question: `should I ${i.task}?` }) as Effect.Effect<Advice, Error>
  }
}

/* ── gen：主 agent，advisor 作为 driver；两者都经 Advisor impl 访问顾问 ── */
const program = EffectAgent.gen({
  connections: ["Advisor"],
  controls: [new Decide()],
}, [advisorDriver], new Map([["Advisor", advisorImpl]]))

console.log("=== Advisor 架构 ===")
console.log("主 agent 影响:", program.agent.controls[0]!.affects.join(", "))
const advisorCtrl = (program.agent.drivers[0] as unknown as { controls: Array<{ affects: ReadonlyArray<string> }> }).controls[0]
console.log("advisor 作为 driver（Consult 影响:", advisorCtrl ? advisorCtrl.affects.join(", ") : "-", ")")

const out = await Effect.runPromise(program.drive(0, { task: "refactor auth module" })) as Advice
console.log("\n=== 主 agent 决定（Decide control 经 impls 咨询 Advisor） ===")
console.log("verdict:", out.verdict)
console.log("reason:", out.reason)

// 也可直接驱动 advisor driver 的 Consult control（index 1）。
const consultOut = await Effect.runPromise(program.drive(1, { question: "should I add tests?" })) as Advice
console.log("\n=== 直接驱动顾问 Consult control ===")
console.log("顾问:", consultOut.verdict, "-", consultOut.reason)
