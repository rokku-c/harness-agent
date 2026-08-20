import { Effect, Schema } from "effect"
import { Agent, Providers, Until } from "effect-agent"

const Plan = Schema.Struct({
  goal: Schema.String,
  steps: Schema.Array(Schema.Struct({
    title: Schema.String,
    doneWhen: Schema.String
  })),
  risks: Schema.Array(Schema.String)
})

const program = Effect.gen(function*() {
  const driver = yield* Providers.agent()

  const Planner = Agent
    .define<string>()
    .returns(Until.schema(Plan))
    .implementedBy(driver)

  return yield* Planner.run("发布一个 TypeScript npm package")
})

const plan = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
)

console.log(JSON.stringify(plan.output, null, 2))
