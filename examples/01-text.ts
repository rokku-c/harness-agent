import { Effect } from "effect"
import { Agent, AgentContext, Providers, Until } from "../src/index.js"

const program = Effect.gen(function*() {
  const driver = yield* Providers.agent()

  const Assistant = Agent
    .define<string>("Assistant", AgentContext.text)
    .returns(Until.stop)
    .implementedBy(driver)

  return yield* Assistant.run("用三句话解释 Effect 的依赖注入。")
})

const answer = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
)

console.log(answer)
