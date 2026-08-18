import { Effect } from "effect"
import { Agent, AgentContext, Providers, Until } from "effect-agent"

const program = Effect.gen(function*() {
  const driver = yield* Providers.agent()

  const Assistant = Agent
    .define<string>( AgentContext.current)
    .returns(Until.stop)
    .implementedBy(driver)

  return yield* Assistant.run("用三句话解释 Effect 的依赖注入。")
})

  const result = await Effect.runPromise(
    program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
  )

  console.log(result.output)
