import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  Context,
  Op,
  PredictionMemory,
  PredictiveHarness,
  runDriver,
  Until,
  type AgentProgram,
  type Binding,
  type Driver,
  type Prediction,
  type PredictionAssessment,
  type PredictionAssessmentRequest,
  type PredictionRequest,
  type StepEvent
} from "../src/index.js"

const capabilities: Driver["capabilities"] = {
  provider: { _tag: "Configurable" }, granularity: "run", thinking: false,
  cancel: false, pause: false, resume: false, fork: "none", tools: "native",
  toolCalls: "observe", structuredOutput: "none", sandbox: "none", subagents: false
}

describe("PredictiveHarness", () => {
  test("predicts, executes, assesses and remembers prediction errors", async () => {
    const order: string[] = []
    const predict: AgentProgram<PredictionRequest, Prediction> = {
      id: "predict", capabilities,
      run: () => Effect.sync(() => {
        order.push("predict")
        return { output: { expected: "expected", assumptions: [] }, details: [] }
      })
    }
    const assess: AgentProgram<PredictionAssessmentRequest, PredictionAssessment> = {
      id: "assess", capabilities,
      run: () => Effect.sync(() => {
        order.push("assess")
        return { output: { correct: false, cause: "different", learning: "inspect actual output" }, details: [] }
      })
    }
    const tool = Op.read({
      name: "example.read",
      description: "read",
      input: Schema.Struct({}),
      output: Schema.String,
      execute: () => Effect.sync(() => {
        order.push("execute")
        return "actual"
      })
    })
    const binding: Binding = { uri: "ea://test/tool", ops: [tool] }
    const base: Driver = {
      id: "base", capabilities,
      start: ({ context }) => Effect.succeed({
        step: context.access[0]!.binding.ops![0]!.execute({}).pipe(
          Effect.map((value): StepEvent => ({ _tag: "Result", value }))
        ) as Effect.Effect<StepEvent, never, never>
      })
    }

    const program = Effect.gen(function*() {
      const result = yield* runDriver(
        PredictiveHarness.withPrediction(base, { predict, assess }) as Driver,
        Context.with({ messages: [{ role: "user", content: "run" }] }).withUntil(Until.stop).withAccess([{ binding, write: false }])
      )
      const memory = yield* PredictionMemory
      return { result, entries: yield* memory.entries }
    }).pipe(Effect.provide(PredictionMemory.layer))

    const result = await Effect.runPromise(program)
    expect(result.result.output).toBe("actual")
    expect(order).toEqual(["predict", "execute", "assess"])
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.learning).toBe("inspect actual output")
  })
})
