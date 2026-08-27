import { Effect } from "effect"
import { runTui } from "@effect-agent/tui/node"
import { makeDemoRepr } from "./demo-core.js"

const program = Effect.gen(function* () {
  const repr = yield* makeDemoRepr()
  yield* runTui(repr).pipe(Effect.ensuring(repr.close.pipe(Effect.ignore)))
})

Effect.runPromise(program).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
