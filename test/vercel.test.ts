import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { MockLanguageModelV4 } from "ai/test"
import { AgentContext, Op, runDriver, Until, VercelAgent, type Binding } from "../src/index.js"

const result = {
  content: [{ type: "text" as const, text: "ok" }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined }
  },
  warnings: []
}

describe("Vercel agent settings", () => {
  test("allows maxOutputTokens override", async () => {
    const model = new MockLanguageModelV4({ doGenerate: result })
    await Effect.runPromise(runDriver(VercelAgent.make({ model, maxOutputTokens: { default: 16384, multiplier: 2, maxAttempts: 1, cap: 16384 } }), AgentContext.current("hello").withUntil(Until.stop)))
    expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(16384)
  })

  test("injects system prompt into generateText when set", async () => {
    const model = new MockLanguageModelV4({ doGenerate: result })
    await Effect.runPromise(runDriver(VercelAgent.make({ model }),
      AgentContext.always("Be terse.").appendCurrent({ _tag: "Text", text: "hello" }).withUntil(Until.stop)))
    // The mock flattens `system` into prompt[0] as a system-role message.
    const call = model.doGenerateCalls[0]!
    expect(call.prompt[0]).toEqual({ role: "system", content: "Be terse." })
    // prompt does not contain the system text as a user part
    expect(JSON.stringify(call.prompt[1])).toContain("Text: hello")
  })

  test("applies toolPrefix to injected op tool names", async () => {
    const model = new MockLanguageModelV4({ doGenerate: result })
    const Echo = Op.read({
      name: "echo.value",
      description: "echo",
      input: Schema.Struct({ text: Schema.String }),
      output: Schema.String,
      execute: ({ text }) => Effect.succeed(text)
    })
    const binding: Binding = { uri: "ea://test/service/echo", ops: [Echo] }
    await Effect.runPromise(runDriver(VercelAgent.make({ model, toolPrefix: "ea_" }),
      AgentContext.current("hello").withUntil(Until.stop).withAccess([{ binding, write: false }])))
    // The tool name in the mock's tools array is the prefixed, sanitized op name.
    const tools = model.doGenerateCalls[0]!.tools ?? []
    expect(tools.some((t) => "name" in t && t.name === "ea_echo_value")).toBe(true)
  })
})
