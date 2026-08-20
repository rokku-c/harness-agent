import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { Context, CodexAgent, runDriver, Until } from "../src/index.js"

describe("capability negotiation", () => {
  test("Codex refuses a pre-execution tool-call boundary", async () => {
    const exit = await Effect.runPromiseExit(runDriver(CodexAgent.make(), Context.with({ messages: [{ role: "user", content: "test" }] }).withUntil(Until.toolCall())))
    expect(exit._tag).toBe("Failure")
  })
})

describe("Codex agent system prompt", () => {
  test("prefixes Context always text into the run prompt", async () => {
    let runPrompt = ""
    const fakeClient = {
      resumeThread: (): any => ({ run: async (prompt: string) => { runPrompt = prompt; return { finalResponse: "ok" } } }),
      startThread: (): any => ({ run: async (prompt: string) => { runPrompt = prompt; return { finalResponse: "ok" } } })
    }
    const context = Context.with({ always: [{ _tag: "Always", text: "Follow X." }], messages: [{ role: "user", content: "user task" }] }).withUntil(Until.stop)
    await Effect.runPromise(runDriver(CodexAgent.make({ client: fakeClient as any }), context))
    expect(runPrompt).toBe("Always: Follow X.\n\nuser task")
  })
})
