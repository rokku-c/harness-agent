import { Effect } from "effect"
import { defaultToSchema, EffectAgent, type Driver } from "effect-agent"

/**
 * 示例 25：Agent 编译器 —— EffectAgent.gen + 描述语言 IR。
 *
 * 核心：agent 不是 builder 链，是 `EffectAgent.gen(...)` 声明式描述，编译成纯数据 **IR**
 * （可序列化、可被 meta-agent 生成、可跨基座解释），`compile()` 才变成可运行 agent。
 * 真正运行的是 IR —— 描述与运行分离、解耦。
 *
 * 流程：
 *   1. gen 收集 IR（纯数据，可 JSON 序列化）；
 *   2. compile 把 IR 编译到具体 driver（fake driver 演示，换真实 driver 即接真模型）；
 *   3. run 运行编译后的 agent。
 *
 * 用法：
 *   bun run example 25-agent-compiler
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

// ── 1. gen：用描述语言声明 agent，产出纯数据 IR ──
const ir = EffectAgent.gen(function*() {
  yield EffectAgent.define("reviewer")
  yield EffectAgent.role("审查项目代码，产出结构化发现")
  yield EffectAgent.produces({
    kind: "schema",
    schema: {
      type: "object",
      properties: {
        verdict: { type: "string" },
        findings: { type: "array", items: { type: "string" } },
      },
      required: ["verdict", "findings"],
    },
  })
  yield EffectAgent.uses({ ref: "project", access: "read" })
  yield EffectAgent.driver("composed", "claude-code")
})

console.log("=== 1. IR（描述语言，纯数据） ===")
console.log(JSON.stringify(ir, null, 2))

// ── 2. compile：把 IR 编译到具体 driver ──
const program = EffectAgent.compile(ir, {
  resolveDriver: (ref) => {
    console.log(`\n=== 2. compile 解析 driver ref ===`)
    console.log(`  ${ref.kind}:${ref.name} → fake driver（换真实即接真模型）`)
    return fakeDriver((input) => input.includes("问题")
      ? { verdict: "ok", findings: ["类型系统约束 agent 协作"] }
      : { verdict: "revise", findings: [] })
  },
  toSchema: defaultToSchema,
})

// ── 3. run：运行编译后的 agent ──
const result = await Effect.runPromise(program.run("我们有个问题：怎么让 agent 协作类型安全？"))

console.log("\n=== 3. 运行结果 ===")
console.log("  output:", result.output)
