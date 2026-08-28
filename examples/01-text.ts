import { Effect } from "effect"
import { Agent, AgentContext, memoryNotationStore, Providers, Until, withNotation } from "../src/index.js"

// The prompt prose lives in notation (versioned, injectable through the
// notation adapter) - the definition references targets, never embeddings.
const notation = memoryNotationStore([
  { target: "assistant/prompt", instructions: ["Answer the question in three sentences.", "Question: {input}"] }
])

const program = Effect.gen(function*() {
  const driver = yield* Providers.agent()

  const Assistant = Agent
    .define<string>("Assistant", withNotation(notation, (input, nl) => AgentContext.text(nl("assistant/prompt", { input }))))
    .returns(Until.stop)
    .implementedBy(driver)

  return yield* Assistant.run("用三句话解释 Effect 的依赖注入。")
})

const answer = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
)

console.log(answer)
