import { Schema } from "effect"
import {
  Agent,
  AgentContext,
  ClaudeCode,
  CodexAgent,
  PiAgent,
  Until,
  type Driver
} from "effect-agent"

const Review = Schema.Struct({
  summary: Schema.String,
  risk: Schema.Literal("low", "medium", "high"),
  findings: Schema.Array(Schema.String)
})

// 业务 Agent 只描述输入和输出，不知道底层是哪个完整外部 Agent。
const PRReview = (driver: Driver) => Agent
  .define<string>((diff) => AgentContext.input({ operation: "review", diff }))
  .returns(Until.schema(Review))
  .implementedBy(driver)

const builtins = [
  { name: "claude-code", driver: ClaudeCode.make() },
  { name: "codex", driver: CodexAgent.make() },
  { name: "pi", driver: PiAgent.make() }
]

// 同一个 PRReview 定义可以 harness 三种 runtime。
const reviewers = builtins.map(({ name, driver }) => ({
  name,
  agent: PRReview(driver)
}))

console.table(reviewers.map(({ name, agent }) => ({
  agent: name,
  provider: agent.capabilities.provider._tag === "Fixed"
    ? agent.capabilities.provider.api
    : "configurable",
  control: agent.capabilities.granularity,
  tools: agent.capabilities.tools,
  object: agent.capabilities.structuredOutput,
  sandbox: agent.capabilities.sandbox
})))

console.log("\nThis example only constructs agents; it does not call external SDKs.")
