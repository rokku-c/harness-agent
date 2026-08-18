import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { AgentContext, CodexAgent, runDriver, Until } from "../src/index.js"

describe("capability negotiation", () => {
  test("Codex refuses a pre-execution tool-call boundary", async () => {
    const exit = await Effect.runPromiseExit(runDriver(CodexAgent.make(), AgentContext.current("test").withUntil(Until.toolCall)))
    expect(exit._tag).toBe("Failure")
  })
})

describe("Codex agent system prompt", () => {
  test("prefixes AgentContext always text into the run prompt", async () => {
    let runPrompt = ""
    const fakeClient = {
      resumeThread: (): any => ({ run: async (prompt: string) => { runPrompt = prompt; return { finalResponse: "ok" } } }),
      startThread: (): any => ({ run: async (prompt: string) => { runPrompt = prompt; return { finalResponse: "ok" } } })
    }
    const context = AgentContext.always("Follow X.").appendCurrent({ _tag: "Text", text: "user task" }).withUntil(Until.stop)
    await Effect.runPromise(runDriver(CodexAgent.make({ client: fakeClient as any }), context))
    expect(runPrompt).toBe("Always: Follow X.\n\nText: user task")
  })
})
