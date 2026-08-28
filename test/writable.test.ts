import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { MockLanguageModelV4 } from "ai/test"
import { fixtureNotation } from "./fixture-notation.js"
import {
  Agent,
  AgentContext,
  AgentFailure,
  ClaudeCode,
  CodexAgent,
  Op,
  PiAgent,
  Until,
  VercelAgent,
  commitSchemaResult,
  type Binding,
  type RunRequest,
  type WritableBinding
} from "../src/index.js"

const requestOf = <R>(access: ReadonlyArray<{ readonly binding: Binding<any, any, R>; readonly write: boolean }>): RunRequest<any, R> => ({
  context: AgentContext.empty,
  until: Until.stop,
  access
})

describe("commitSchemaResult", () => {
  test("writes the decoded value to a single declared-write binding", async () => {
    const written: unknown[] = []
    const binding: Binding<any> = { uri: "ea://test/out", write: (value: unknown) => Effect.sync(() => { written.push(value) }) }
    await Effect.runPromise(commitSchemaResult(requestOf([{ binding, write: true }]), { ok: true }, "agent-x"))
    expect(written).toEqual([{ ok: true }])
  })

  test("commits the same output to every declared-write binding in order and skips read-only access", async () => {
    const order: string[] = []
    const a: Binding<any> = { uri: "ea://a", write: (value: unknown) => Effect.sync(() => { order.push("a:" + JSON.stringify(value)) }) }
    const readOnly: Binding<any> = { uri: "ea://ro", ops: [] }
    const b: Binding<any> = { uri: "ea://b", write: (value: unknown) => Effect.sync(() => { order.push("b:" + JSON.stringify(value)) }) }
    const req = requestOf([{ binding: a, write: true }, { binding: readOnly, write: false }, { binding: b, write: true }])
    await Effect.runPromise(commitSchemaResult(req, 42, "agent-x"))
    expect(order).toEqual(["a:42", "b:42"])
  })

  test("a failing write fails the run as AgentFailure keeping the cause", async () => {
    const boom = new Error("disk full")
    const binding: Binding<any, Error> = { uri: "ea://test/out", write: () => Effect.fail(boom) }
    const failure = await Effect.runPromise(Effect.flip(commitSchemaResult(requestOf([{ binding, write: true }]), 1, "agent-x")))
    expect(failure).toBeInstanceOf(AgentFailure)
    const err = failure as AgentFailure
    expect(err.agent).toBe("agent-x")
    expect(err.cause).toBe(boom)
  })
})

describe("schema commit integration", () => {
  test("vercel commits the decoded schema result", async () => {
    const written: unknown[] = []
    const binding: WritableBinding<any> = { uri: "ea://test/out", write: (value: unknown) => Effect.sync(() => { written.push(value) }) }
    // Output.object parses the model text as JSON (ai output-spec parseCompleteOutput),
    // so a text part carrying the JSON payload is enough for a V4 mock.
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: "text" as const, text: JSON.stringify({ ok: true }) }],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined }
        },
        warnings: []
      }
    })
    const driver = VercelAgent.make({ model })
    const program = Agent.define<string>("s", (s) => AgentContext.raw(s))
      .returns(Until.schema(Schema.Struct({ ok: Schema.Boolean })))
      .writes(binding)
      .implementedBy(driver)
    const result = await Effect.runPromise(program.run("hello"))
    expect(result).toEqual({ ok: true })
    expect(written).toEqual([{ ok: true }])
  })

  test("codex commits the decoded schema result", async () => {
    const written: unknown[] = []
    const binding: WritableBinding<any> = { uri: "ea://test/out", write: (value: unknown) => Effect.sync(() => { written.push(value) }) }
    const thread = { run: async () => ({ sessionId: "s", finalResponse: JSON.stringify({ ok: true }) }) }
    const client = { startThread: () => thread } as any
    const driver = CodexAgent.make({ client })
    const program = Agent.define<string>("s", (s) => AgentContext.raw(s))
      .returns(Until.schema(Schema.Struct({ ok: Schema.Boolean })))
      .writes(binding)
      .implementedBy(driver)
    const result = await Effect.runPromise(program.run("hello"))
    expect(result).toEqual({ ok: true })
    expect(written).toEqual([{ ok: true }])
  })

  test("pi commits the decoded schema result", async () => {
    const written: unknown[] = []
    const binding: WritableBinding<any> = { uri: "ea://test/out", write: (value: unknown) => Effect.sync(() => { written.push(value) }) }
    const createSession = (async (options: any) => {
      const outputTool = options.customTools.find((tool: any) => tool.name === "effect_agent_return")
      await outputTool.execute("id", { ok: true })
      return { session: { prompt: async () => {}, messages: [], abort: async () => {} } }
    }) as any
    const driver = PiAgent.make({ createSession })
    const program = Agent.define<string>("s", (s) => AgentContext.raw(s))
      .returns(Until.schema(Schema.Struct({ ok: Schema.Boolean })))
      .writes(binding)
      .implementedBy(driver)
    const result = await Effect.runPromise(program.run("hello"))
    expect(result).toEqual({ ok: true })
    expect(written).toEqual([{ ok: true }])
  })

  test("claude-code commits the decoded schema result", async () => {
    const written: unknown[] = []
    const binding: WritableBinding<any> = { uri: "ea://test/out", write: (value: unknown) => Effect.sync(() => { written.push(value) }) }
    const fakeQuery = (async function* () {
      yield { type: "result", subtype: "success", structured_output: { ok: true }, result: "" }
    }) as any
    const driver = ClaudeCode.make({ query: fakeQuery })
    const program = Agent.define<string>("s", (s) => AgentContext.raw(s))
      .returns(Until.schema(Schema.Struct({ ok: Schema.Boolean })))
      .writes(binding)
      .implementedBy(driver)
    const result = await Effect.runPromise(program.run("hello"))
    expect(result).toEqual({ ok: true })
    expect(written).toEqual([{ ok: true }])
  })
})

describe("claude-code mount gate (SDK readOnly unsupported)", () => {
  const fakeQuery = (async function* () {
    yield { type: "result", subtype: "success", result: "ok" }
  }) as any

  test("no declared writes reports declaredWrites 0 and keeps the default permissionMode", async () => {
    const prepared: any[] = []
    const driver = ClaudeCode.make({ query: fakeQuery })
    const readOnly: Binding<any> = { uri: "ea://ro", ops: [] }
    await Effect.runPromise(driver.run({
      context: AgentContext.raw("hello"),
      until: Until.stop,
      access: [{ binding: readOnly, write: false }],
      report: (event) => Effect.sync(() => { prepared.push(event) })
    }))
    const details = prepared.find((event) => event._tag === "DriverPrepared")?.details
    expect(details.declaredWrites).toBe(0)
    expect(details.permissionMode).toBe("default")
  })

  test("declared writes are reported and explicit permissionMode is respected", async () => {
    const prepared: any[] = []
    const writable: WritableBinding<any> = { uri: "ea://out", write: () => Effect.void }
    const driver = ClaudeCode.make({ query: fakeQuery, permissionMode: "acceptEdits" })
    await Effect.runPromise(driver.run({
      context: AgentContext.raw("hello"),
      until: Until.stop,
      access: [{ binding: writable, write: true }],
      report: (event) => Effect.sync(() => { prepared.push(event) })
    }))
    const details = prepared.find((event) => event._tag === "DriverPrepared")?.details
    expect(details.declaredWrites).toBe(1)
    expect(details.permissionMode).toBe("acceptEdits")
  })
})

describe("access filter regression", () => {
  test("pi injects only ops whose access is declared (read-only binding exposes no write ops)", async () => {
    const nl = fixtureNotation([
      { target: "ops/svc-read", instructions: ["read"] },
      { target: "ops/svc-write", instructions: ["write"] }
    ])
    const readOp = Op.read({
      name: "svc.read", description: nl("ops/svc-read"),
      input: Schema.String, output: Schema.String,
      execute: () => Effect.succeed("ok")
    })
    const writeOp = Op.write({
      name: "svc.write", description: nl("ops/svc-write"),
      input: Schema.String, output: Schema.String,
      execute: () => Effect.succeed("ok")
    })
    const binding: Binding<any> = { uri: "ea://svc", ops: [readOp, writeOp] }
    let seen: any[] = []
    const createSession = (async (options: any) => {
      seen = options.customTools
      return { session: { prompt: async () => {}, messages: [], abort: async () => {} } }
    }) as any
    const driver = PiAgent.make({ createSession })
    await Effect.runPromise(driver.run({
      context: AgentContext.raw("x"),
      until: Until.stop,
      access: [{ binding, write: false }]
    }))
    const names = seen.map((tool: any) => tool.name)
    expect(names).toContain("svc.read")
    expect(names).not.toContain("svc.write")
  })
})

// Negative type cases (docs/writable.md D2): writes() rejects a non-writable
// binding at compile time. bun test does not type-check; these lines are
// validated by `bun run typecheck` (tsc --noEmit) via @ts-expect-error.
// @ts-expect-error writes() requires a WritableBinding
Agent.define<string>("neg", (s) => AgentContext.raw(s)).returns(Until.stop).writes({ uri: "ea://test/plain" })

// Positive companion: a WritableBinding compiles.
Agent.define<string>("pos", (s) => AgentContext.raw(s)).returns(Until.stop).writes({ uri: "ea://test/w", write: () => Effect.void })