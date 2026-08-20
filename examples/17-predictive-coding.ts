import { Effect } from "effect"
import {
  Agent,
  Harness,
  Prediction,
  PredictionAssessment,
  PredictionMemory,
  PredictiveHarness,
  ProjectEnvironment,
  Providers,
  Until,
  type PredictionAssessmentRequest,
  type PredictionRequest
} from "effect-agent"
import { resolve } from "node:path"
import { DetailHook } from "./hooks/detailed-review.js"

const task = Bun.argv.slice(3).join(" ")

const program = Effect.gen(function*() {
  const providers = yield* Providers
  const raw = providers.agent()

  const predict = Agent
    .define<PredictionRequest>()
    .returns(Until.schema(Prediction))
    .implementedBy(raw)

  const assess = Agent
    .define<PredictionAssessmentRequest>()
    .returns(Until.schema(PredictionAssessment))
    .implementedBy(raw)

  const driver = Harness.withHooks(
    PredictiveHarness.withPrediction(raw, { predict, assess }),
    DetailHook
  )
  const project = ProjectEnvironment.make({
    root: resolve(import.meta.dir, ".."),
    scope: "src/"
  })

  const agent = Agent
    .define<string>()
    .returns(Until.stop)
    .uses(project)
    .implementedBy(driver)

  const result = yield* agent.run(task)
  const memory = yield* PredictionMemory
  return { output: result.output, memory: yield* memory.entries }
})

const result = await Effect.runPromise(program.pipe(
  Effect.provide(Providers.layer({ path: "config.toml" })),
  Effect.provide(PredictionMemory.layer)
))

console.log(JSON.stringify(result, null, 2))
