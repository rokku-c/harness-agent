import { Effect, Schema } from "effect"
import { Agent, AgentContext, ClaudeCode, memoryNotationStore, Until, withNotation } from "../src/index.js"

const notation = memoryNotationStore([
  {
    target: "planner/prompt",
    instructions: [
      "Analyze the task and draft a plan (respond in Simplified Chinese). Do not modify any files.",
      "",
      "{task}"
    ]
  }
])

const Plan = Schema.Struct({
  goal: Schema.String,
  steps: Schema.Array(Schema.Struct({
    title: Schema.String,
    doneWhen: Schema.String
  })),
  risks: Schema.Array(Schema.String)
})

const program = Effect.gen(function*() {
  // Claude Code is a complete external Agent and does not use the
  // anthropic.messages provider from config.toml. Authentication is read
  // directly by the Claude Agent SDK.
  const driver = yield* ClaudeCode.configured({
    path: "config.toml",
    provider: "claude",
    overrides: {
      cwd: process.cwd(),
      maxTurns: 3,
      permissionMode: "plan",
      tools: [],
      settingSources: [],
      persistSession: false
    }
  })

  const Planner = Agent
    .define<string>("ClaudeCodePlanner", withNotation(notation, (task, nl) => AgentContext.text(nl("planner/prompt", { task }))))
    .returns(Until.schema(Plan))
    .implementedBy(driver)

  return yield* Planner.run("发布一个 TypeScript npm package")
})

const plan = await Effect.runPromise(program)

console.log(JSON.stringify(plan, null, 2))
