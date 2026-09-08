import { expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { AgentContext, Until } from "@effect-agent/core"
import { EffectAgent } from "@effect-agent/builtin"
import { runAgent, scriptedModel, weatherOp } from "./loop-fixture.ts"

const Plan = Schema.Struct({ goal: Schema.String, steps: Schema.Array(Schema.String) })
const asTool = { name: "submit_plan", description: "Return the completed plan" }

test("Until.schema returns only the decoded protocol tool input and exposes the declared schema", async () => {
  const input = { goal: "ship", steps: ["build", "test"] }
  const model = scriptedModel([{ text: "not the result", toolCalls: [{ id: "p", name: asTool.name, input }] }])
  expect(await Effect.runPromise(runAgent(model, Until.schema(Plan, asTool)))).toEqual(input)
  expect(model.calls).toBe(1)
  expect(model.lastTools).toEqual([{ name: asTool.name, description: asTool.description,
    input: { type: "object", required: ["goal", "steps"], properties: {
      goal: { type: "string" }, steps: { type: "array", items: { type: "string" } },
    }, additionalProperties: false } }])
})

test("a missing asTool fails before any model generation", async () => {
  const model = scriptedModel([{ text: '{"goal":"ship","steps":[]}' }])
  const result = await Effect.runPromise(runAgent(model, Until.schema(Plan)).pipe(Effect.either))
  expect(result._tag).toBe("Left")
  if (result._tag === "Left") expect(result.left.cause)
    .toBe("EffectAgent structured output requires Until.schema with a named asTool declaration")
  expect(model.calls).toBe(0)
})

test("empty protocol names and op collisions fail instead of enabling a text fallback", async () => {
  for (const name of ["", " ", "lookup"]) {
    const model = scriptedModel([{ text: "not called" }])
    const result = await Effect.runPromise(runAgent(model, Until.schema(Plan, { name }),
      [{ binding: { uri: "ea://svc/weather/main", ops: [weatherOp()] }, write: false }]).pipe(Effect.either))
    expect(result._tag).toBe("Left")
    expect(model.calls).toBe(0)
  }
})

test("planTools cannot hide the protocol result tool", async () => {
  const input = { goal: "ship", steps: [] }
  const model = scriptedModel([{ text: "", toolCalls: [{ id: "p", name: asTool.name, input }] }])
  const driver = EffectAgent.make({ model, planTools: () => [] })
  const result = await Effect.runPromise(driver.run({ context: AgentContext.text("plan"),
    until: Until.schema(Plan, asTool), access: [] }))
  expect(result).toEqual(input)
  expect(model.lastTools?.map((tool) => tool.name)).toEqual([asTool.name])
})
