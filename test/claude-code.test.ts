import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { AgentContext, Op, Until, notationText, type Access, type Binding, type RunRequest } from "@effect-agent/core"
import { ClaudeCode, type ClaudeCodeOptions } from "@effect-agent/builtin"
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk"

const op = Op.read({
  name: "lookup_weather",
  description: notationText("Look up the current weather for a city."),
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.Struct({ temp: Schema.Number }),
  execute: ({ city }) => Effect.succeed({ temp: 24, city })
})

const weatherBinding: Binding = {
  uri: "ea://svc/weather/main",
  ops: [op]
}

/** A stub query: records the options, replays scripted SDK messages. */
const stubQuery = (script: ReadonlyArray<SDKMessage>) => {
  const calls: Array<{ prompt: string; options: any }> = []
  const query = ((args: { prompt: string; options?: any }) => {
    calls.push({ prompt: args.prompt, options: args.options })
    return (async function* () {
      for (const message of script) yield message
    })() as any
  }) as any as ClaudeCodeOptions["query"]
  return { query, calls }
}

const msg = (m: SDKMessage) => m

const runWith = (until: UntilT<any>, script: ReadonlyArray<SDKMessage>, access: ReadonlyArray<Access> = []) => {
  const { query, calls } = stubQuery(script)
  const driver = ClaudeCode.make({ query, model: "claude-x", maxTurns: 1 })
  return { output: driver.run({ context: AgentContext.text("weather?"), until, access }), calls }
}

type UntilT<A> = import("@effect-agent/core").Until<A>

describe("ClaudeCode: the ComposedAgent adapter", () => {
  test("Until.text: the result message's text comes back", async () => {
    const { output, calls } = runWith(Until.text, [
      msg({ type: "assistant", message: { content: [{ type: "text", text: "thinking out loud" }] } } as any),
      msg({ type: "result", subtype: "success", result: "final text" } as any)
    ])
    const text = await Effect.runPromise(output)
    expect(text).toBe("final text")
    expect(calls[0]?.prompt).toContain("weather?")
  })

  test("Until.toolCall: the pre-execution tool_use comes back", async () => {
    const { output } = runWith(Until.toolCall, [
      msg({ type: "assistant", message: { content: [{ type: "tool_use", id: "u1", name: "Read", input: { p: "x" } }] } } as any),
      msg({ type: "result", subtype: "success", result: "" } as any)
    ])
    const call = await Effect.runPromise(output)
    expect(call._tag).toBe("ToolCall")
    expect(call.name).toBe("Read")
    expect(call.id).toBe("u1")
  })

  test("Until.schema: structured_output decodes against the schema", async () => {
    const Plan = Schema.Struct({ goal: Schema.String })
    const { output } = runWith(Until.schema(Plan), [
      msg({ type: "result", subtype: "success", structured_output: { goal: "ship" } } as any)
    ])
    const plan = await Effect.runPromise(output)
    expect(plan.goal).toBe("ship")
  })

  test("binding ops become native MCP tools with allowed names", async () => {
    const { output, calls } = runWith(Until.text, [
      msg({ type: "result", subtype: "success", result: "done" } as any)
    ], [{ binding: weatherBinding, write: false }])
    await Effect.runPromise(output)
    const options = calls[0]?.options
    expect(options.mcpServers.effect_agent).toBeDefined()
    expect(options.allowedTools).toContain("mcp__effect_agent__lookup_weather")
  })

  test("write ops stay out without write access", async () => {
    const writeOp = Op.write({
      name: "file_issue",
      description: notationText("Files one issue per incident."),
      input: Schema.Struct({ title: Schema.String }),
      output: Schema.Struct({ issue: Schema.Number }),
      execute: ({ title }) => Effect.succeed({ issue: 17 })
    })
    const github: Binding = { uri: "ea://svc/github/main", ops: [writeOp] }
    const { output, calls } = runWith(Until.text, [
      msg({ type: "result", subtype: "success", result: "done" } as any)
    ], [{ binding: github, write: false }])
    await Effect.runPromise(output)
    expect(calls[0]?.options.allowedTools).toHaveLength(0)
  })

  test("the capability contract is checked up front (unsupported until fails before any run)", async () => {
    // EffectAgent does not expose thinking - Until.thinking must be rejected
    // by the contract check before the loop starts (main's requireUntil)
    const { EffectAgent } = await import("@effect-agent/builtin")
    const driver = EffectAgent.make({ model: { generate: () => Effect.succeed({ text: "x", toolCalls: [] }) } })
    const request: RunRequest<string> = { context: AgentContext.empty, until: Until.thinking, access: [] }
    const failed = await Effect.runPromise(
      driver.run(request).pipe(Effect.either)
    )
    expect(failed._tag).toBe("Left")
    if (failed._tag === "Left") expect((failed.left as { _tag: string })._tag).toBe("UnsupportedCapability")
  })
})

