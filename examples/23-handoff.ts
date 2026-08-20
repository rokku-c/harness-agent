import { Effect, Schema } from "effect"
import { Handoff, Harness, Until, type Driver } from "effect-agent"
import { DetailHook } from "./hooks/detailed-review.js"

/**
 * 示例 23：回合制衔接（Handoff 磁吸链）—— A 提议 → Judge 判定 → 通过才接 B。
 *
 * 全部内联成一条链：每步只声明「产出契约（until）+ 执行者（driver）」，输入由磁吸推导。
 * 无需预先 `const A = Agent.define(...)` / `const Idea = Schema.Struct(...)`。
 *
 * 磁吸体现在类型层：`.then(...)` 的 agent 输入自动 = 上一步输出；`.when(..., cond)`
 * 的 cond 拿到上一步的类型化输出（Idea），不匹配编译错误。
 *
 * 用法：
 *   bun run example 23-handoff
 */

/** fake driver：从 context.messages 读文本，返回固定结构化输出。 */
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

const observed = (d: Driver) => Harness.withHooks(d, DetailHook)

// ── 磁吸链：A → Judge → (判定 ok 才) B —— 完全内联 ──
const program = Effect.gen(function*() {
  const chain = Handoff.step(
    Until.schema(Schema.Struct({ idea: Schema.String, promising: Schema.Boolean })),
    observed(fakeDriver((input) => input.includes("问题")
      ? { idea: "用 Schema 强类型工具输入，让类型系统约束 agent 协作", promising: true }
      : { idea: "暂无", promising: false }))
  )
    .then(
      Until.schema(Schema.Struct({ verdict: Schema.Literal("ok", "revise") })),
      observed(fakeDriver((input) => input.includes("promising")
        ? { verdict: "ok" }
        : { verdict: "revise" }))
    )
    .when(
      Until.stop,
      observed(fakeDriver((input) => `执行者已接受判定：${JSON.stringify(input)}`)),
      (verdict) => verdict.verdict === "ok"   // verdict 类型 = 上一步 Schema 输出
    )

  return yield* chain.run("我们有个问题：怎么让多 agent 协作类型安全？")
})

const result = await Effect.runPromise(program)

console.log("\n=== 回合制衔接结果 ===")
console.log("  最终输出:", result.output)
