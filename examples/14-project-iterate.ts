import { Data, Effect, Schema } from "effect"
import {
  Agent,
  Harness,
  ProjectEnvironment,
  Providers,
  Until
} from "effect-agent"
import { resolve } from "node:path"
import { DetailHook } from "./hooks/detailed-review.js"

const args = Bun.argv.slice(3)
const valueOf = (name: string, fallback: string) => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1]! : fallback
}

const provider = args.includes("--provider") ? valueOf("--provider", "") : undefined
const scope = valueOf("--focus", "src/")
const write = args.includes("--execute")
const task = valueOf("--task", "")

class MissingTask extends Data.TaggedError("MissingTask")<{}> {}

const Iteration = Schema.Struct({
  summary: Schema.String,
  changedFiles: Schema.Array(Schema.String),
  verification: Schema.Struct({
    typecheck: Schema.String,
    test: Schema.String
  }),
  next: Schema.Array(Schema.String)
})

const program = Effect.gen(function*() {
  if (!task) return yield* Effect.fail(new MissingTask())
  const providers = yield* Providers
  const driver = Harness.withHooks(providers.agent(provider), DetailHook)
  const project = ProjectEnvironment.make({
    root: resolve(import.meta.dir, ".."),
    scope,
    write
  })

  const iteration = Agent
    .define<{ readonly objective: string; readonly write: boolean }>()
    .returns(Until.schema(Iteration))

  const runnable = write
    ? iteration.writes(project).implementedBy(driver)
    : iteration.uses(project).implementedBy(driver)

  return yield* runnable.run({
    objective: task,
    write
  })
})

const result = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" }))) as never
) as { output: typeof Iteration.Type }

console.log(JSON.stringify(result.output, null, 2))
