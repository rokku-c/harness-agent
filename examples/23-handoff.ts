import { Effect, Schema } from "effect"
import { Agent, Handoff, Harness, Until, type Driver } from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"

/**
 * 示例 23：回合制衔接（Handoff 磁吸链）—— A 提议 → Judge 判定 → 通过才接 B。
 *
 * 核心：多 agent 协作 = 正交原语的组合。这里用 `Handoff` 磁吸链表达「行动顺序」：
 *   1. A 先生成提议（结构化 Idea）；
 *   2. Judge 基于 A 的提议判定（ok / revise）—— 磁吸：Judge 输入自动是 A 的输出；
 *   3. 判定 ok 才让 B 继续（条件磁吸）。
 *
 * 磁吸体现在类型层：`.then(Judge)` 要求 Judge 的输入 == A 的输出类型，
 * 不匹配直接编译错误；`.when(B, cond)` 的 cond 拿到 A 的类型化输出。
 *
 * 用法：
 *   bun run example 23-handoff
 */

/** 一个 fake driver：从 context.messages 读文本，返回固定结构化输出。 */
const fakeDriver = (respond: (prompt: string) => unknown): Driver => ({
  id: "fake",
  capabilities: {
    provider: { _tag: "Configurable" }, granularity: "event", thinking: false, cancel: false,
    pause: false, resume: false, fork: "none", tools: "native", toolCalls: "observe",
    structuredOutput: "native", sandbox: "none", subagents: false
  },
  start: (request) => Effect.sync(() => ({
    step: Effect.succeed({
      _tag: "Result",
      value: respond(request.context.messages.map((m) => m.content).join(" "))
    })
  }))
})

const Idea = Schema.Struct({ idea: Schema.String, promising: Schema.Boolean })
type Idea = typeof Idea.Type
const Verdict = Schema.Struct({ verdict: Schema.Literal("ok", "revise") })
type Verdict = typeof Verdict.Type

// ── 三个 agent：A（提议者）→ Judge（判定者）→ B（执行者）──
// 都用 fake driver 演示编排形状；换成真实 driver 即接真模型。
const observed = (d: Driver) => Harness.withHooks(d, DetailHook)

const A = Agent.define<string>().returns(Until.schema(Idea))
  .implementedBy(observed(fakeDriver((input) => input.includes("问题")
    ? { idea: "用 Schema 强类型工具输入，让类型系统约束 agent 协作", promising: true }
    : { idea: "暂无", promising: false })))

const Judge = Agent.define<Idea>().returns(Until.schema(Verdict))
  .implementedBy(observed(fakeDriver((input) => input.includes("promising")
    ? { verdict: "ok" }
    : { verdict: "revise" })))

const B = Agent.define<Verdict>().returns(Until.stop)
  .implementedBy(observed(fakeDriver((input) => `执行者已接受判定：${JSON.stringify(input)}`)))

// ── 磁吸链：A → Judge → (判定 ok 才) B ──
const program = Effect.gen(function*() {
  const chain = Handoff.step(A)
    .then(Judge)
    .when(B, (verdict) => verdict.verdict === "ok")

  return yield* chain.run("我们有个问题：怎么让多 agent 协作类型安全？")
})

const result = await Effect.runPromise(program)

console.log("\n=== 回合制衔接结果 ===")
console.log("  最终输出:", result.output)
