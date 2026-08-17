import { Effect, Schema } from "effect"
import { Agent, AgentContext, ClaudeCode, Until } from "../src/index.js"

const Plan = Schema.Struct({
  goal: Schema.String,
  steps: Schema.Array(Schema.Struct({
    title: Schema.String,
    doneWhen: Schema.String
  })),
  risks: Schema.Array(Schema.String)
})

const program = Effect.gen(function*() {
  // Claude Code 是完整的外部 Agent，不使用 config.toml 中的
  // anthropic.messages provider。认证由 Claude Agent SDK 自己读取。
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
    .define<string>("ClaudeCodePlanner", (task) => AgentContext.text(
      `只分析任务并制定计划（设置语言：简体中文），不要修改任何文件：\n\n${task}`
    ))
    .returns(Until.schema(Plan))
    .implementedBy(driver)

  return yield* Planner.run("发布一个 TypeScript npm package")
})

const plan = await Effect.runPromise(program)

console.log(JSON.stringify(plan, null, 2))
