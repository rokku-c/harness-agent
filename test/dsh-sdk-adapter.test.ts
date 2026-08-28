import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { Effect, Fiber, Stream } from "effect"
import {
  compile,
  connectionAdapter,
  ConnectionRuntime,
  type AgentIR,
  type ConnectionEvent
} from "@effect-agent/core"
import {
  dshConnectionSpec,
  dshSdkAdapter,
  DshCapabilities,
  type DshConnectionError,
  type DshHarnessLike
} from "@effect-agent/builtin"

const kind = "builtin.dsh"

interface FakeRun {
  readonly input: string
  readonly sessionId?: string
}

interface FakeHarness extends DshHarnessLike {
  readonly starts: { readonly count: number }
  readonly runs: FakeRun[]
  readonly closes: { readonly count: number }
}

const fakeHarness = (overrides: Partial<DshHarnessLike> = {}): FakeHarness => {
  const state = { starts: { count: 0 }, runs: [] as FakeRun[], closes: { count: 0 } }
  return {
    starts: state.starts,
    runs: state.runs,
    closes: state.closes,
    start: async () => { state.starts.count++ },
    run: async (input, options) => {
      state.runs.push({ input, sessionId: options?.sessionId })
      return {
        sessionId: options?.sessionId ?? "fake-session",
        finalResponse: "echo: " + input,
        events: [{
          type: "assistant/message",
          data: { message: { content: [{ type: "text", text: "echo: " + input }] } }
        }]
      }
    },
    close: async () => { state.closes.count++ },
    ...overrides
  }
}

const specOf = () => dshConnectionSpec({ id: "dsh", adapters: [{ kind }] })

const runtimeOf = (harness: DshHarnessLike) =>
  ConnectionRuntime.make({
    specs: [specOf()],
    adapters: [dshSdkAdapter({ client: () => harness })]
  })

const tagOf = (value: unknown): string | undefined =>
  "_tag" in (value as { _tag?: unknown }) ? (value as { _tag: string })._tag : undefined

describe("dsh connection adapter", () => {
  test("eager start failure fails connect and participates in failover", async () => {
    const failing = fakeHarness({ start: async () => { throw new Error("start boom") } })
    const fallback = fakeHarness()
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [dshConnectionSpec({
        id: "dsh",
        adapters: [
          { kind, priority: 0 },
          { kind: "fallback", priority: 1 }
        ]
      })],
      adapters: [
        dshSdkAdapter({ client: () => failing }),
        connectionAdapter({
          kind: "fallback",
          capabilities: new Set([DshCapabilities.agentRun]),
          connect: (connection) => Effect.succeed({
            connectionId: connection.id,
            adapter: "fallback",
            capabilities: new Set([DshCapabilities.agentRun]),
            invoke: () => Effect.succeed({ sessionId: "fallback", finalResponse: "fallback ok" }),
            close: Effect.void
          })
        })
      ]
    }))
    const result = await Effect.runPromise(runtime.invoke("dsh", DshCapabilities.agentRun, { prompt: "hi" }))
    expect(result).toEqual({ sessionId: "fallback", finalResponse: "fallback ok" })
    // the half-open client of the failed eager start was closed before the error propagated
    expect(failing.closes.count).toBe(1)
  })

  test("eager start failure without a fallback fails open with a DshConnectionError cause", async () => {
    const failing = fakeHarness({ start: async () => { throw new Error("start boom") } })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [specOf()],
      adapters: [dshSdkAdapter({ client: () => failing })]
    }))
    const failure = await Effect.runPromise(Effect.flip(runtime.open("dsh")))
    expect(tagOf(failure)).toBe("ConnectionOpenError")
    const attempts = (failure as unknown as { attempts: ReadonlyArray<{ cause: unknown }> }).attempts
    expect(tagOf(attempts[0].cause)).toBe("DshConnectionError")
    expect(String((attempts[0].cause as Error).message)).toContain("dsh adapter: start failed: start boom")
  })

  test("dsh.agent.run invokes the injected client and returns { sessionId, finalResponse }", async () => {
    const harness = fakeHarness()
    const runtime = await Effect.runPromise(runtimeOf(harness))
    const result = await Effect.runPromise(runtime.invoke("dsh", DshCapabilities.agentRun, {
      prompt: "hello",
      sessionId: "s1"
    }))
    expect(result).toEqual({ sessionId: "s1", finalResponse: "echo: hello" })
    expect(harness.runs).toEqual([{ input: "hello", sessionId: "s1" }])
    expect(harness.starts.count).toBe(1)
    const session = await Effect.runPromise(runtime.open("dsh"))
    expect([...session.capabilities]).toEqual([DshCapabilities.agentRun])
  })

  test("start is idempotent and repeatable on the fake", async () => {
    const harness = fakeHarness()
    const runtime = await Effect.runPromise(runtimeOf(harness))
    const session = await Effect.runPromise(runtime.open("dsh"))
    // connect ran start once; repeated calls on the same client must not throw
    // (the SDK memoizes start; the fake is idempotent by contract)
    await harness.start()
    await harness.start()
    expect(harness.starts.count).toBe(3)
    await Effect.runPromise(runtime.close("dsh"))
  })

  test("compiles through the GraphProgram graph with envelope unwrapping", async () => {
    const harness = fakeHarness()
    const runtime = await Effect.runPromise(runtimeOf(harness))
    const ir: AgentIR = {
      input: { type: "object" },
      output: { type: "object" },
      connections: [{ ref: "dsh", requires: [DshCapabilities.agentRun] }],
      entry: { connection: "dsh", capability: DshCapabilities.agentRun }
    }
    const program = await Effect.runPromise(compile(ir, runtime))
    const result = await Effect.runPromise(program.run({ prompt: "你好", sessionId: "s1" }))
    expect(result).toEqual({ sessionId: "s1", finalResponse: "echo: 你好" })
    expect(harness.runs).toEqual([{ input: "你好", sessionId: "s1" }])
  })

  test("RunResult.events are forwarded as ConnectionEvents", async () => {
    const harness = fakeHarness()
    const runtime = await Effect.runPromise(runtimeOf(harness))
    const session = await Effect.runPromise(runtime.open("dsh"))
    const collected: ConnectionEvent[] = []
    // fork/join must live in one effect: a forked fiber is interrupted when the
    // runPromise fiber that created it finishes.
    let result: unknown
    await Effect.runPromise(Effect.gen(function* () {
      const collector = yield* Effect.fork(
        Stream.runForEach(session.events!, (event) => Effect.sync(() => { collected.push(event) }))
      )
      result = yield* runtime.invoke("dsh", DshCapabilities.agentRun, { prompt: "hello" })
      // let the collector fiber drain the published events before the stream is shut down
      yield* Effect.sleep("10 millis")
      yield* runtime.close("dsh")
      yield* Fiber.join(collector)
    }))
    expect(result).toEqual({ sessionId: "fake-session", finalResponse: "echo: hello" })
    expect(collected).toHaveLength(1)
    expect(collected[0].kind).toBe("dsh.agent.event")
    expect(collected[0].connectionId).toBe("dsh")
    expect(collected[0].adapter).toBe(kind)
    expect(collected[0].payload).toEqual({
      type: "assistant/message",
      data: { message: { content: [{ type: "text", text: "echo: hello" }] } }
    })
  })

  test("a subscribed events stream terminates on close instead of hanging", async () => {
    const harness = fakeHarness()
    const runtime = await Effect.runPromise(runtimeOf(harness))
    const session = await Effect.runPromise(runtime.open("dsh"))
    let finished = false
    await Effect.runPromise(Effect.gen(function* () {
      const collector = yield* Effect.fork(
        Stream.runForEach(session.events!, () => Effect.void).pipe(
          Effect.ensuring(Effect.sync(() => { finished = true }))
        )
      )
      yield* runtime.close("dsh")
      yield* Fiber.join(collector)
    }))
    expect(finished).toBe(true)
  })

  test("unknown capabilities fail with a DshConnectionError", async () => {
    const harness = fakeHarness()
    const runtime = await Effect.runPromise(runtimeOf(harness))
    const session = await Effect.runPromise(runtime.open("dsh"))
    const failure = await Effect.runPromise(Effect.flip(session.invoke("bogus.capability", {})))
    expect(tagOf(failure)).toBe("DshConnectionError")
    expect(String((failure as Error).message)).toContain("dsh adapter: unknown capability: bogus.capability")
  })

  test("dsh.agent.run requires a string prompt", async () => {
    const harness = fakeHarness()
    const runtime = await Effect.runPromise(runtimeOf(harness))
    const failure = await Effect.runPromise(Effect.flip(runtime.invoke("dsh", DshCapabilities.agentRun, {})))
    expect(tagOf(failure)).toBe("DshConnectionError")
    expect(String((failure as Error).message)).toContain("dsh adapter: dsh.agent.run requires a string prompt")
  })

  test("errors keep structured fields (cause, code, exitCode, stderrTail)", async () => {
    const sdkError = Object.assign(new Error("rpc boom"), {
      code: -32000,
      data: { detail: "bad" },
      exitCode: 3,
      stderrTail: "trace..."
    })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [specOf()],
      adapters: [dshSdkAdapter({ client: () => fakeHarness({ run: async () => { throw sdkError } }) })]
    }))
    const failure = await Effect.runPromise(Effect.flip(runtime.invoke("dsh", DshCapabilities.agentRun, { prompt: "hi" })))
    expect(tagOf(failure)).toBe("DshConnectionError")
    const err = failure as DshConnectionError
    expect(err.message).toContain("dsh adapter: dsh.agent.run failed: rpc boom")
    expect(err.capability).toBe(DshCapabilities.agentRun)
    expect(err.cause).toBe(sdkError)
    expect(err.code).toBe(-32000)
    expect(err.data).toEqual({ detail: "bad" })
    expect(err.exitCode).toBe(3)
    expect(err.stderrTail).toBe("trace...")
  })

  test("close is idempotent and close errors are ignored", async () => {
    const harness = fakeHarness()
    const runtime = await Effect.runPromise(runtimeOf(harness))
    const session = await Effect.runPromise(runtime.open("dsh"))
    await Effect.runPromise(session.close)
    await Effect.runPromise(session.close)
    expect(harness.closes.count).toBe(2)

    const throwing = fakeHarness({ close: async () => { throw new Error("close boom") } })
    const runtime2 = await Effect.runPromise(runtimeOf(throwing))
    const session2 = await Effect.runPromise(runtime2.open("dsh"))
    await expect(Effect.runPromise(session2.close)).resolves.toBeUndefined()
  })

  test("a malformed ref.config.launch fails loud instead of falling back", async () => {
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [dshConnectionSpec({ id: "dsh", adapters: [{ kind, config: { launch: { command: 42 } } }] })],
      adapters: [dshSdkAdapter()]
    }))
    const failure = await Effect.runPromise(Effect.flip(runtime.open("dsh")))
    expect(tagOf(failure)).toBe("ConnectionOpenError")
    const attempts = (failure as unknown as { attempts: ReadonlyArray<{ cause: unknown }> }).attempts
    expect(tagOf(attempts[0].cause)).toBe("DshConnectionError")
    expect(String((attempts[0].cause as Error).message)).toContain("dsh adapter: ref.config.launch is malformed")
  })

  test("connect fails cleanly when no client is injected and no launch config exists", async () => {
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [specOf()],
      adapters: [dshSdkAdapter({})]
    }))
    const failure = await Effect.runPromise(Effect.flip(runtime.open("dsh")))
    expect(tagOf(failure)).toBe("ConnectionOpenError")
    const attempts = (failure as unknown as { attempts: ReadonlyArray<{ cause: unknown }> }).attempts
    expect(String((attempts[0].cause as Error).message)).toContain("dsh adapter: no launch config provided")
  })

  test("concurrent first invokes single-flight the open: exactly one client is constructed", async () => {
    let constructs = 0
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [specOf()],
      adapters: [dshSdkAdapter({ client: () => { constructs++; return fakeHarness() } })]
    }))
    const [a, b] = await Promise.all([
      Effect.runPromise(runtime.invoke("dsh", DshCapabilities.agentRun, { prompt: "a" })),
      Effect.runPromise(runtime.invoke("dsh", DshCapabilities.agentRun, { prompt: "b" }))
    ])
    expect((a as { finalResponse: string }).finalResponse).toBe("echo: a")
    expect((b as { finalResponse: string }).finalResponse).toBe("echo: b")
    // Single-flight open (P8): the loser of the CAS waits on the owner's
    // Deferred instead of constructing a second client.
    expect(constructs).toBe(1)
  })
})

// Real-runtime smoke, gated on DSH_ROOT && DEEPSEEK_API_KEY (design section 2.9):
// with either missing this self-skips and the gate is recorded in the test output.
const smokeGated = (() => {
  const root = process.env.DSH_ROOT
  const key = process.env.DEEPSEEK_API_KEY
  if (!root || !key) {
    const missing = [!root && "DSH_ROOT", !key && "DEEPSEEK_API_KEY"].filter(Boolean).join(", ")
    console.log("[dsh smoke] skipped: missing " + missing)
    return false
  }
  return true
})()

describe.skipIf(!smokeGated)("dsh real-runtime smoke (DSH_ROOT + DEEPSEEK_API_KEY)", () => {
  test("runs 你好 through the adapter against a real runtime and leaves no child processes", async () => {
    const root = process.env.DSH_ROOT!
    const runtimeBin = join(root, "packages/examples/jsonrpc-demo/lib/bin.js")
    const cordis = join(root, "examples/jsonrpc-agent/cordis.yml")
    const sdkLib = join(root, "packages/sdk/client/lib/index.js")
    // preflight build artifacts so a broken runtime does not look like an adapter bug
    for (const artifact of [runtimeBin, cordis, sdkLib]) {
      if (!existsSync(artifact)) throw new Error("[dsh smoke] preflight artifact missing: " + artifact)
    }
    // The SDK client cannot be installed into this repo (its workspace-protocol
    // deps only resolve inside deepseek-harness, F1), so import the built lib by
    // absolute path — the same artifact the preflight above verified.
    const sdk = await import(sdkLib)
    const harness = new sdk.DeepSeekHarness({ launch: { command: "node", args: [runtimeBin, cordis] } })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [dshConnectionSpec({ id: "dsh-smoke", adapters: [{ kind }] })],
      adapters: [dshSdkAdapter({ client: () => harness })]
    }))
    const result = await Effect.runPromise(runtime.invoke("dsh-smoke", DshCapabilities.agentRun, {
      prompt: "你好"
    })) as { sessionId: string; finalResponse: string }
    expect(typeof result.finalResponse).toBe("string")
    expect(result.finalResponse.length).toBeGreaterThan(0)
    console.log("[dsh smoke] finalResponse: " + result.finalResponse)
    await Effect.runPromise(runtime.close("dsh-smoke"))
    const leftover = spawnSync("pgrep", ["-f", "jsonrpc-demo/lib/bin.js"])
    expect(leftover.status).not.toBe(0)
  })
})
