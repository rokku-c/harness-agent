/**
 * Sequential composition via Agent.chain: format -> review, one agent's
 * output feeding the next's input. Types are fully inferred (no IR note):
 * string -> Format(string) -> string -> Review(string) -> string. The chain
 * is a Chained - callable AND .then-able, accumulating E/R unions - not an
 * AgentProgram (a composite has no single offer surface; events/runIds come
 * from the constituent agents). A failing step short-circuits the rest.
 */
import { Effect } from "effect"
import { Agent, AgentContext, Providers, Until } from "../src/index.js"

const program = Effect.gen(function*() {
  const driver = yield* Providers.agent()

  const Format = Agent
    .define<string>("format", (input) => AgentContext.text("格式化: " + input))
    .returns(Until.stop)
    .implementedBy(driver)

  const Review = Agent
    .define<string>("review", (input) => AgentContext.text("审阅: " + input))
    .returns(Until.stop)
    .implementedBy(driver)

  // type flow: string -> Format(string) -> string -> Review(string) -> string;
  // a failure in Format short-circuits: Review never runs.
  const chain = Agent.chain(Format).then(Review)
  return yield* chain("一份设计稿")
})

const answer = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
)

console.log(answer)
