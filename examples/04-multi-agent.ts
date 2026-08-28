import { Effect, Schema } from "effect"
import { Agent, AgentContext, memoryNotationStore, Providers, Until, withNotation } from "../src/index.js"

const notation = memoryNotationStore([
  {
    target: "explorer/prompt",
    instructions: [
      "Think independently and propose one approach for the question below.",
      "Do not assume the other agents' conclusions.",
      "",
      "{task}"
    ]
  }
])

const Proposal = Schema.Struct({
  approach: Schema.String,
  advantages: Schema.Array(Schema.String),
  concern: Schema.String
})

const program = Effect.gen(function*() {
  const providers = yield* Providers

  const explorers = providers.names.map((provider) => Agent
    .define<string>(`Explorer:${provider}`, withNotation(notation, (task, nl) => AgentContext.text(nl("explorer/prompt", { task }))))
    .returns(Until.schema(Proposal))
    .implementedBy(providers.agent(provider)))

  const proposals = yield* Agent.map(
    explorers,
    "如何为一个 coding agent 设计安全且容易理解的工具权限系统？"
  )

  return providers.names.map((provider, index) => ({ provider, proposal: proposals[index] }))
})

const results = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
)

console.log(JSON.stringify(results, null, 2))
