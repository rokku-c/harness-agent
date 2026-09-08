import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { Op, Until, notationText } from "@effect-agent/core"
import { scriptedModel, runAgent } from "./loop-fixture.ts"

describe("EffectAgent tool access", () => {
  test("write ops are excluded without write access, included with it", async () => {
    const writeOp = Op.write({
      name: "file_issue",
      description: notationText("Files one issue per incident."),
      input: Schema.Struct({ title: Schema.String }),
      output: Schema.Struct({ issue: Schema.Number }),
      execute: ({ title }) => Effect.succeed({ issue: 17 })
    })
    const model = scriptedModel([{ text: "done" }])
    const binding = { uri: "ea://svc/github/main", ops: [writeOp] }
    await Effect.runPromise(runAgent(model, Until.text, [{ binding, write: false }]))
    expect(model.lastTools).toHaveLength(0)
    await Effect.runPromise(runAgent(model, Until.text, [{ binding, write: true }]))
    expect(model.lastTools).toHaveLength(1)
  })

})
