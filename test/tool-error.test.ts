import { describe, expect, test } from "bun:test"
import { Effect, Schema, type Runtime } from "effect"
import { MockLanguageModelV4 } from "ai/test"
import {
  Agent,
  AgentContext,
  AgentFailure,
  Harness,
  Op,
  PiAgent,
  toolErrorJson,
  Until,
  VercelAgent,
  type Binding,
  type Driver
} from "../src/index.js"
import { mcpTools } from "../src/composed/claude-code.js"

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined }
}

const Flaky = Op.read({
  name: "flaky",
  description: "a tool that always fails",
  input: Schema.Struct({}),
  output: Schema.String,
  execute: () => Effect.fail(new Error("boom"))
})
const binding: Binding<any> = { uri: "ea://flaky", ops: [Flaky] }
const access = [{ binding, write: false }]

describe("tool error channel (B3b)", () => {
  test("toolErrorJson formats model-visible errors with truncation", async () => {
    expect(toolErrorJson(new Error("boom"))).toBe(JSON.stringify({ error: "boom", retryable: true }))
    expect(toolErrorJson("plain string")).toBe(JSON.stringify({ error: "plain string", retryable: true }))
    expect(toolErrorJson(new Error("nope"), false)).toBe(JSON.stringify({ error: "nope", retryable: false }))
    const long = "x".repeat(3000)
    const out = JSON.parse(toolErrorJson(new Error(long))) as { error: string; retryable: boolean }
    expect(out.error.length).toBe(2000)
    expect(out.error).toBe("x".repeat(2000))
    expect(toolErrorJson(new Error("boom"))).not.toContain("at ")
  })

  test("vercel: a failing op returns a structured tool error the model can retry and the run still succeeds", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [
        {
          content: [{ type: "tool-call" as const, toolCallId: "call-1", toolName: "flaky", input: JSON.stringify({}) }],
          finishReason: { unified: "tool-calls" as const, raw: undefined },
          usage,
          warnings: []
        },
        {
          content: [{ type: "text" as const, text: "done" }],
          finishReason: { unified: "stop" as const, raw: undefined },
          usage,
          warnings: []
        }
      ]
    })
    const program = Agent.define<string>("s", (s) => AgentContext.text(s))
      .returns(Until.stop)
      .uses(binding)
      .implementedBy(VercelAgent.make({ model }))
    const output = await Effect.runPromise(program.run("hello"))
    expect(output).toBe("done")
    expect(model.doGenerateCalls.length).toBe(2)
    const secondCall = model.doGenerateCalls[1]!
    const toolResult = secondCall.prompt
      .flatMap((m) => (Array.isArray((m as { content?: unknown }).content) ? (m as { content: unknown[] }).content : []))
      .find((part) => (part as { type?: string }).type === "tool-result") as
      { output: { type: string; value: unknown } } | undefined
    expect(toolResult).toBeDefined()
    expect(JSON.parse(String((toolResult!.output as { value: string }).value))).toEqual({ error: "boom", retryable: true })
  })

  test("pi: a failing op becomes a text tool result instead of rejecting the prompt", async () => {
    let tools: Array<{ name: string; execute: (id: string, input: unknown) => Promise<{ content: Array<{ type: string; text: string }> }> }> = []
    const createSession = async (options: any) => {
      tools = options.customTools
      return { session: { prompt: async () => {}, messages: [], abort: async () => {} } }
    }
    const driver = PiAgent.make({ createSession: createSession as any })
    await Effect.runPromise(driver.run({
      context: AgentContext.text("x"), until: Until.stop, access
    }))
    const flaky = tools.find((t) => t.name === "flaky")
    expect(flaky).toBeDefined()
    const result = await flaky!.execute("call-1", {})
    expect(result.content[0].text).toBe(JSON.stringify({ error: "boom", retryable: true }))
  })

  test("claude-code: a failing op becomes a text tool result the model can retry", async () => {
    const runtime = await Effect.runPromise(
      Effect.gen(function* () { return yield* Effect.runtime<any>() }) as Effect.Effect<Runtime.Runtime<any>, never, never>
    )
    const tools = mcpTools({ context: AgentContext.text("x"), until: Until.stop, access }, runtime)
    const def = tools[0]!.definition
    const result = await def.handler({}, undefined)
    expect((result.content[0] as { type: string; text: string }).text).toBe(JSON.stringify({ error: "boom", retryable: true }))
  })

  test("hooks: a failing op emits ToolStarted + ToolFailed (no ToolCompleted) and the run still succeeds", async () => {
    const events: string[] = []
    const hook = Harness.hook("capture", (event) => Effect.sync(() => events.push(event._tag)))
    const driver: Driver = {
      id: "fake",
      capabilities: {
        provider: { _tag: "Configurable" }, granularity: "run", thinking: false,
        cancel: false, pause: false, resume: false, fork: "none",
        tools: "native", toolCalls: "observe", structuredOutput: "none", sandbox: "none"
      },
      // Driver layer converts the op failure into a structured result (B3b).
      run: (request) => request.access[0]!.binding.ops![0]!.execute({}).pipe(
        Effect.either,
        Effect.map((result) => result._tag === "Left" ? toolErrorJson(result.left) : result.right)
      ) as any
    }
    const output = await Effect.runPromise(Harness.withHooks(driver, hook).run({
      context: AgentContext.text("x"), until: Until.stop, access
    }))
    expect(output).toBe(JSON.stringify({ error: "boom", retryable: true }))
    expect(events).toEqual(["RunStarted", "ToolStarted", "ToolFailed", "Output", "RunCompleted"])
  })

  test("vercel: an op with onError: 'fail' fails the run as AgentFailure while hooks still see ToolFailed", async () => {
    const FailOp = Op.read({
      name: "boom",
      description: "a tool that must fail the run",
      input: Schema.Struct({}),
      output: Schema.String,
      onError: "fail" as const,
      execute: () => Effect.fail(new Error("boom"))
    })
    const failBinding: Binding<any> = { uri: "ea://boom", ops: [FailOp] }
    const model = new MockLanguageModelV4({
      doGenerate: [
        {
          content: [{ type: "tool-call" as const, toolCallId: "call-1", toolName: "boom", input: JSON.stringify({}) }],
          finishReason: { unified: "tool-calls" as const, raw: undefined },
          usage,
          warnings: []
        },
        {
          content: [{ type: "text" as const, text: "done" }],
          finishReason: { unified: "stop" as const, raw: undefined },
          usage,
          warnings: []
        }
      ]
    })
    const events: string[] = []
    const hook = Harness.hook("capture", (event) => Effect.sync(() => events.push(event._tag)))
    const program = Agent.define<string>("s", (s) => AgentContext.text(s))
      .returns(Until.stop)
      .uses(failBinding)
      .implementedBy(Harness.withHooks(VercelAgent.make({ model }), hook))
    const failure = await Effect.runPromise(Effect.flip(program.run("hello")))
    expect(failure).toBeInstanceOf(AgentFailure)
    expect(String((failure as AgentFailure).cause)).toContain("boom")
    // The control-plane escape hatch still observes the failure end-to-end.
    expect(events).toContain("ToolFailed")
    expect(events).not.toContain("ToolCompleted")
    expect(events).toContain("RunFailed")
  })
})