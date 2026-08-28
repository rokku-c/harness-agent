/**
 * Sequential composition via Agent.chain: format -> review, one agent's
 * output feeding the next's input. Types are fully inferred (no IR note):
 * string -> Format(string) -> string -> Review(string) -> string. The chain
 * is a Chained - callable AND .then-able, accumulating E/R unions - not an
 * AgentProgram (a composite has no single offer surface; events/runIds come
 * from the constituent agents). A failing step short-circuits the rest.
 *
 * Both steps' prompt prose lives in notation - the definitions reference
 * targets.
 */
import { Effect } from "effect"
import { Agent, AgentContext, memoryNotationStore, Providers, Until, withNotation } from "../src/index.js"

const notation = memoryNotationStore([
  { target: "chain/format", instructions: ["Format the following draft: {input}"] },
  { target: "chain/review", instructions: ["Review the formatted draft: {input}"] }
])

const program = Effect.gen(function*() {
  const driver = yield* Providers.agent()

  const Format = Agent
    .define<string>("format", withNotation(notation, (input, nl) => AgentContext.text(nl("chain/format", { input }))))
    .returns(Until.stop)
    .implementedBy(driver)

  const Review = Agent
    .define<string>("review", withNotation(notation, (input, nl) => AgentContext.text(nl("chain/review", { input }))))
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
