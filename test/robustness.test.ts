import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { AgentContext, Until } from "@effect-agent/core"
import { EffectAgent } from "@effect-agent/builtin"
import { scriptedModel } from "./loop-fixture.ts"

const Out = Schema.Struct({ reply: Schema.String })
const asTool = { name: "submit_reply", description: "Return the structured reply" }

describe("structured-output robustness", () => {
  for (const text of ['{"reply":"sensitive-model-text"}', '```json\n{"reply":"sensitive-model-text"}\n```',
    "sensitive-model-text", ""]) test(`text reply ${JSON.stringify(text)} fails immediately without leaking it`, async () => {
    const model = scriptedModel([{ text }])
    const driver = EffectAgent.make({ model, decodeRetries: 5 })
    const result = await Effect.runPromise(driver.run<typeof Out.Type, never>({ context: AgentContext.text("go"),
      until: Until.schema(Out, asTool), access: [] }).pipe(Effect.either))
    expect(result._tag).toBe("Left")
    if (result._tag === "Left") expect(result.left.cause)
      .toBe("Structured result requires the declared asTool tool call; plain-text replies are not accepted")
    expect(model.calls).toBe(1)
  })

  for (const decodeRetries of [0, 2]) test(`malformed tool input fails after exactly ${decodeRetries} retries`, async () => {
    const badCall = { text: "", toolCalls: [{ id: "c", name: asTool.name, input: {} }] }
    const model = scriptedModel([badCall, badCall, badCall])
    const driver = EffectAgent.make({ model, decodeRetries })
    const result = await Effect.runPromise(driver.run<typeof Out.Type, never>({ context: AgentContext.text("go"),
      until: Until.schema(Out, asTool), access: [] }).pipe(Effect.either))
    expect(result._tag).toBe("Left")
    expect(model.calls).toBe(decodeRetries + 1)
  })

  test("a malformed result recovers through tool feedback, without synthetic user retries", async () => {
    const model = scriptedModel([
      { text: "", toolCalls: [{ id: "bad", name: asTool.name, input: {} }] },
      { text: "", toolCalls: [{ id: "good", name: asTool.name, input: { reply: "done" } }] },
    ])
    const driver = EffectAgent.make({ model, decodeRetries: 1 })
    const result = await Effect.runPromise(driver.run<typeof Out.Type, never>({ context: AgentContext.text("go"),
      until: Until.schema(Out, asTool), access: [] }))
    expect(result).toEqual({ reply: "done" })
    expect(model.calls).toBe(2)
    expect(model.lastThread?.filter((message) => message.role === "user")).toHaveLength(1)
    const feedback = model.lastThread?.find((message) => message.role === "tool")
    expect(feedback?.role === "tool" && feedback.id).toBe("bad")
  })
})
