import { Schema } from "effect"
import {
  Agent,
  AgentContext,
  ClaudeCode,
  CodexAgent,
  PiAgent,
  Until,
  type Driver
} from "../src/index.js"

const Review = Schema.Struct({
  summary: Schema.String,
  risk: Schema.Literal("low", "medium", "high"),
  findings: Schema.Array(Schema.String)
})

// The business Agent only describes input and output; it does not know which
// complete external Agent sits underneath.
const PRReview = (driver: Driver) => Agent
  .define<string>("PRReview", (diff) => AgentContext.text(`Review this diff:\n${diff}`))
  .returns(Until.schema(Review))
  .implementedBy(driver)

const builtins = [
  { name: "claude-code", driver: ClaudeCode.make() },
  { name: "codex", driver: CodexAgent.make() },
  { name: "pi", driver: PiAgent.make() }
]

// The same PRReview definition can harness three runtimes.
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
