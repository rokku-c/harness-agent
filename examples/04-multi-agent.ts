import { Effect, Schema } from "effect"
import { Agent, Providers, Until } from "effect-agent"

const Proposal = Schema.Struct({
  approach: Schema.String,
  advantages: Schema.Array(Schema.String),
  concern: Schema.String
})

const program = Effect.gen(function*() {
  const providers = yield* Providers

  const explorers = providers.names.map((provider) => Agent
    .define<string>()
    .returns(Until.schema(Proposal))
    .implementedBy(providers.agent(provider)))

  const proposals = yield* Agent.map(
    explorers,
    "如何为一个 coding agent 设计安全且容易理解的工具权限系统？"
  )

  return providers.names.map((provider, index) => ({ provider, proposal: proposals[index]!.output }))
})

const results = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
)

console.log(JSON.stringify(results, null, 2))
