import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { AgentContext, CodexAgent, Until } from "../src/index.js"

describe("capability negotiation", () => {
  test("Codex refuses a pre-execution tool-call boundary", async () => {
    const exit = await Effect.runPromiseExit(CodexAgent.make().run({
      context: AgentContext.raw("test"),
      until: Until.toolCall,
      access: []
    }))
    expect(exit._tag).toBe("Failure")
  })
})
