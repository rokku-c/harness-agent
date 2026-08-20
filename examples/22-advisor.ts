import { Effect, pipe, Schema } from "effect"
import { Agent, AgentContext, Stage, then, Until, type Driver } from "../src/index.js"

/**
 * 示例 22：Advisor 架构 —— 主 agent 在关键决策点咨询更强的顾问 agent。
 *
 * 参考：https://code.claude.com/docs/en/advisor
 * 主 agent（Sonnet 级）干活，在提交前/卡住时调用顾问（Opus 级）获取建议。
 *
 * 用 effect-agent 表达：
 *   - 主 agent 与顾问 agent 都是普通 Agent；
 *   - 顾问的「咨询」能力通过 Connection 暴露为主 agent 的一个工具；
 *   - 主 agent 在运行中自主决定调用它（模型驱动，非预编排）；
 *   - 顾问收到完整上下文，返回建议。
 */

const Suggestion = Schema.Struct({
  verdict: Schema.Literal("approve", "reconsider"),
  reason: Schema.String,
  suggestions: Schema.Array(Schema.String),
})

const Review = Schema.Struct({
  summary: Schema.String,
  advisorVerdict: Schema.String,
  advisorReason: Schema.String,
})

// ── 1. 顾问 agent：更强模型，给建议 ──
const advisorDriver: Driver = {
  id: "advisor",
  capabilities: {
    provider: { _tag: "Fixed", api: "anthropic.messages" }, granularity: "run", thinking: true,
    cancel: true, pause: false, resume: false, fork: "none",
    tools: "native", toolCalls: "observe", structuredOutput: "native", sandbox: "none", subagents: false,
  },
  start: (request) => Effect.succeed({
    step: Effect.succeed({
      _tag: "Result",
      value: {
        verdict: "reconsider",
        reason: "改动会影响公共 API，需要补测试",
        suggestions: ["加测试", "更新文档"],
        // 透传：证明顾问看到了完整上下文
        _context: request.context.current.map(e => e._tag === "Text" ? e.text : "").join(""),
      },
    } as any),
  }),
}

const Advisor = Agent
  .define<string>("Advisor", (ctx) => AgentContext.current(ctx))
  .returns(Until.schema(Suggestion))
  .implementedBy(advisorDriver)

// ── 2. 主 agent：把顾问作为「咨询工具」接入，运行时自主调用 ──
//    模拟：主 agent 在提交前调用 consult_advisor 工具，获得建议。
const mainDriver: Driver = {
  id: "main",
  capabilities: {
    provider: { _tag: "Fixed", api: "anthropic.messages" }, granularity: "run", thinking: true,
    cancel: true, pause: false, resume: false, fork: "none",
    tools: "native", toolCalls: "observe", structuredOutput: "native", sandbox: "none", subagents: false,
  },
  start: (request) => Effect.succeed({
    step: Effect.succeed({
      _tag: "Result",
      value: {
        summary: "完成重构",
        advisorVerdict: "reconsider",
        advisorReason: "改动会影响公共 API，需要补测试",
        _consulted: true,
      },
    } as any),
  }),
}

// 主 agent 通过 Connection 接入顾问：顾问的能力成为主 agent 的工具
const MainAgent = Agent
  .define<string>("Main", (task) => AgentContext.current(task))
  .returns(Until.schema(Review))
  .uses({
    uri: "ea://local/agents/advisor",
    ops: [{
      name: "consult_advisor",
      description: "在关键决策点咨询顾问，获取更强的建议。",
      access: "read" as const,
      input: Schema.Struct({ context: Schema.String }),
      output: Suggestion,
      execute: ({ context }) => Advisor.run(context).pipe(
        Effect.map((r) => r.output)
      ) as any,
    }],
  })
  .implementedBy(mainDriver)

const result = await Effect.runPromise(
  MainAgent.run("重构 auth 模块") as unknown as Effect.Effect<{
    output: { summary: string; advisorVerdict: string; advisorReason: string }
    details: ReadonlyArray<unknown>
  }, never, never>
)

console.log("Advisor 架构表达验证：")
console.log("  主 agent:", result.output.summary)
console.log("  咨询顾问:", result.output.advisorVerdict, "—", result.output.advisorReason)
console.log("  关键点：主 agent 的工具列表里有 consult_advisor，运行时自主调用")
