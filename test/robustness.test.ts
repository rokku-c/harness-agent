import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { AgentContext, Until, decodeJson } from "@effect-agent/core"
import { EffectAgent, type Model } from "@effect-agent/builtin"

type Script = Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }>
const scriptedModel = (script: Script): Model & { calls: number } => {
  const queue = [...script]
  const model: { calls: number; generate: (s: string, m: unknown[], t: unknown[]) => Effect.Effect<unknown> } = {
    calls: 0,
    generate: () => {
      model.calls++
      return Effect.succeed(queue.shift() ?? { text: "done" })
    }
  }
  return model as unknown as Model & { calls: number }
}

describe("structured-output robustness", () => {
  test("decodeJson extracts a JSON object from a fenced code block", async () => {
    const Out = Schema.Struct({ reply: Schema.String })
    const decoded = await Effect.runPromise(decodeJson(Out, "Sure!\n```json\n{\"reply\":\"done\"}\n```"))
    expect(decoded.reply).toBe("done")
  })
  test("decodeJson falls back to the last balanced object in prose", async () => {
    const Out = Schema.Struct({ ok: Schema.Boolean })
    const decoded = await Effect.runPromise(decodeJson(Out, "Here you go: {\"ok\": true} hope that helps"))
    expect(decoded.ok).toBe(true)
  })
  test("a plain-text reply that does not decode fails once with a readable cause", async () => {
    const Out = Schema.Struct({ reply: Schema.String })
    const model = scriptedModel([{ text: "just some prose" }])
    const driver = EffectAgent.make({ model })
    const result = await Effect.runPromise((driver.run({ context: AgentContext.text("go"), until: Until.schema(Out), access: [] }) as Effect.Effect<unknown>).pipe(Effect.either))
    expect(result._tag).toBe("Left")
    const cause = JSON.stringify((result as { left: { cause: unknown } }).left.cause)
    expect(cause).toContain("did not decode")
    expect(model.calls).toBe(1)
  })
  test("a malformed structured-result tool call fails after the decode budget", async () => {
    const Out = Schema.Struct({ reply: Schema.String })
    const badCall = { text: "", toolCalls: [{ id: "c1", name: "final_answer", input: {} }] }
    const model = scriptedModel([badCall, badCall, badCall])
    const driver = EffectAgent.make({ model, decodeRetries: 2 })
    const result = await Effect.runPromise((driver.run({
      context: AgentContext.text("go"),
      until: Until.schema(Out, { name: "final_answer", description: "structured result" }),
      access: []
    }) as Effect.Effect<unknown>).pipe(Effect.either))
    expect(result._tag).toBe("Left")
    expect(model.calls).toBe(3)
  })
})
