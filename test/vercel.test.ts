import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { MockLanguageModelV4 } from "ai/test"
import { AgentContext, Until, VercelAgent } from "../src/index.js"

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
  test("defaults maxOutputTokens to 8192", async () => {
    const model = new MockLanguageModelV4({ doGenerate: result })
    await Effect.runPromise(VercelAgent.make({ model }).run({
      context: AgentContext.text("hello"), until: Until.stop, access: []
    }))
    expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(8192)
  })

  test("returns reasoningText for Until.thinking", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [
          { type: "reasoning" as const, text: "let me think" },
          { type: "text" as const, text: "final" }
        ],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined }
        },
        warnings: []
      }
    })
    const output = await Effect.runPromise(VercelAgent.make({ model }).run({
      context: AgentContext.text("hello"), until: Until.thinking, access: []
    }))
    expect(output).toBe("let me think")
  })

  test("allows maxOutputTokens override", async () => {
    const model = new MockLanguageModelV4({ doGenerate: result })
    await Effect.runPromise(VercelAgent.make({ model, maxOutputTokens: 16384 }).run({
      context: AgentContext.text("hello"), until: Until.stop, access: []
    }))
    expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(16384)
  })
})
