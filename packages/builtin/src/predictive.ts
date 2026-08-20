import { Context, Data, Effect, Layer, Ref, Schema } from "effect"
import type { AgentProgram, Driver, Result } from "@effect-agent/core"

export const Prediction = Schema.Struct({
  expected: Schema.String,
  assumptions: Schema.Array(Schema.String)
})
export type Prediction = typeof Prediction.Type

export const PredictionAssessment = Schema.Struct({
  correct: Schema.Boolean,
  cause: Schema.String,
  learning: Schema.String
})
export type PredictionAssessment = typeof PredictionAssessment.Type

export interface PredictionRequest {
  readonly tool: string
  readonly input: unknown
  readonly memories: ReadonlyArray<PredictionMemoryEntry>
}

export interface PredictionAssessmentRequest {
  readonly tool: string
  readonly input: unknown
  readonly prediction: Prediction
  readonly output: unknown
}

export interface PredictionMemoryEntry {
  readonly tool: string
  readonly input: unknown
  readonly prediction: Prediction
  readonly output: unknown
  readonly cause: string
  readonly learning: string
}

export interface PredictionMemoryService {
  readonly entries: Effect.Effect<ReadonlyArray<PredictionMemoryEntry>>
  readonly remember: (entry: PredictionMemoryEntry) => Effect.Effect<void>
}

export class PredictionMemory extends Context.Tag("Harness/PredictionMemory")<PredictionMemory, PredictionMemoryService>() {
  static layer: Layer.Layer<PredictionMemory> = Layer.effect(this, Ref.make<ReadonlyArray<PredictionMemoryEntry>>([]).pipe(
    Effect.map((ref) => ({
      entries: Ref.get(ref),
      remember: (entry) => Ref.update(ref, (entries) => [...entries, entry])
    }))
  ))
}

export class PredictionFailure extends Data.TaggedError("PredictionFailure")<{
  readonly phase: "predict" | "assess" | "remember"
  readonly tool: string
  readonly cause: unknown
}> {}

export interface PredictiveHarnessOptions<EP, RP, EA, RA> {
  readonly predict: AgentProgram<PredictionRequest, Prediction, EP, RP>
  readonly assess: AgentProgram<PredictionAssessmentRequest, PredictionAssessment, EA, RA>
}

/** Adds predict → execute → assess → learn semantics to every injected Binding Op. */
export const PredictiveHarness = {
  withPrediction: <RD, EP, RP, EA, RA>(
    driver: Driver<RD>,
    options: PredictiveHarnessOptions<EP, RP, EA, RA>
  ): Driver<RD | RP | RA | PredictionMemory> => ({
    ...driver,
    start: (request) => Effect.gen(function*() {
      const memory = yield* PredictionMemory
      const access = request.context.access.map(({ binding, write }) => ({
        write,
        binding: {
          ...binding,
          ops: binding.ops?.map((op) => ({
            ...op,
            execute: (input: unknown) => Effect.gen(function*() {
              const memories = yield* memory.entries
              const predicted = yield* options.predict.run({ tool: op.name, input, memories }).pipe(
                Effect.mapError((cause) => new PredictionFailure({ phase: "predict", tool: op.name, cause }))
              )
              const output = yield* op.execute(input)
              const assessed = yield* options.assess.run({
                tool: op.name,
                input,
                prediction: predicted.output,
                output
              }).pipe(
                Effect.mapError((cause) => new PredictionFailure({ phase: "assess", tool: op.name, cause }))
              )
              if (!assessed.output.correct) {
                yield* memory.remember({
                  tool: op.name,
                  input,
                  prediction: predicted.output,
                  output,
                  cause: assessed.output.cause,
                  learning: assessed.output.learning
                })
              }
              return output
            })
          }))
        }
      }))
      return yield* driver.start({ ...request, context: request.context.withAccess(access) })
    }) as never
  })
}
