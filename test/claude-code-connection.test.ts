import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { ConnectionRuntime } from "@effect-agent/core"
import {
  ClaudeCodeCapabilities,
  claudeCodeAdapter,
  claudeCodeConnectionSpec
} from "@effect-agent/builtin/claude-code/node"

describe("Claude Code connection adapter", () => {
  test("runs through the SDK while keeping description and behavior separate", async () => {
    let prompt = ""
    const fakeQuery = ((params: any) => (async function* () {
      for await (const message of params.prompt) prompt = message.message.content
      yield { type: "system", subtype: "init", session_id: "session-1" }
      yield { type: "assistant", message: { content: [{ type: "text", text: "hello" }] }, session_id: "session-1" }
      yield { type: "result", subtype: "success", result: "hello", session_id: "session-1" }
    })()) as any

    const adapter = claudeCodeAdapter({
      kind: "test.claude-code",
      sdk: { query: fakeQuery }
    })
    const spec = claudeCodeConnectionSpec({
      id: "reasoner",
      adapters: [{ kind: adapter.kind }],
      capabilities: [ClaudeCodeCapabilities.run]
    })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({ specs: [spec], adapters: [adapter] }))
    const output = await Effect.runPromise(runtime.invoke("reasoner", ClaudeCodeCapabilities.run, {
      prompt: "hello connection"
    })) as any

    expect(prompt).toBe("hello connection")
    expect(output.sessionId).toBe("session-1")
    expect(output.result.result).toBe("hello")
    expect(output.messages).toHaveLength(3)
    const undeclared = await Effect.runPromise(Effect.flip(runtime.invoke("reasoner", ClaudeCodeCapabilities.sessionDelete, {
      sessionId: "session-1"
    })))
    expect("_tag" in undeclared ? undeclared._tag : undefined).toBe("ConnectionCapabilityNotDeclared")
    await Effect.runPromise(runtime.close("reasoner"))
  })

  test("controls an active run through a separate capability invocation", async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    let selectedModel = ""
    const fakeQuery = (() => {
      const running = (async function* () {
        yield { type: "system", subtype: "init", session_id: "session-live" }
        await gate
        yield { type: "result", subtype: "success", result: "done", session_id: "session-live" }
      })() as any
      running.setModel = async (model: string) => { selectedModel = model }
      running.close = () => release()
      return running
    }) as any
    const adapter = claudeCodeAdapter({ kind: "test.claude-live", sdk: { query: fakeQuery } })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [claudeCodeConnectionSpec({
        id: "live",
        adapters: [{ kind: adapter.kind }],
        capabilities: [ClaudeCodeCapabilities.run, ClaudeCodeCapabilities.setModel]
      })],
      adapters: [adapter]
    }))

    const result = Effect.runPromise(runtime.invoke("live", ClaudeCodeCapabilities.run, {
      runId: "run-1",
      prompt: "wait"
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Effect.runPromise(runtime.invoke("live", ClaudeCodeCapabilities.setModel, {
      runId: "run-1",
      model: "claude-opus"
    }))
    expect(selectedModel).toBe("claude-opus")
    release()
    expect((await result as any).result.result).toBe("done")
    await Effect.runPromise(runtime.close("live"))
  })
})
