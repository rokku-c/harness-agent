import { Effect } from "effect"
import {
  Agent,
  AgentContext,
  AgentKeeper,
  ComposedAgent,
  Messenger,
  Providers,
  Until
} from "effect-agent"

/**
 * A completed Harness Agent can be named by the application as a ComposedAgent
 * and kept alive without changing its one-shot Agent definition.
 */
const program = Effect.scoped(Effect.gen(function*() {
  const driver = yield* Providers.agent()
  const oneShot = Agent
    .define<string>(AgentContext.current)
    .returns(Until.stop)
    .implementedBy(driver)

  const composed = ComposedAgent.make(oneShot)
  const keeper = yield* AgentKeeper.make(composed, { capacity: 8 })

  const first = yield* keeper.send("解释 Context 和 Binding 的关系")
  const second = yield* keeper.send("解释 Driver 和 Session 的关系")
  yield* keeper.shutdown

  return [first.output, second.output]
}))

const result = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
    .pipe(Effect.provide(Messenger.layer))
)

console.log(result)
