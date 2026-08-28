import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { ConnectionRuntime, type AdapterRef } from "@effect-agent/core"
import {
  dshConnectionSpec,
  dshSdkAdapter,
  DshCapabilities,
  resolveConfig,
  sdkLaunchOf,
  type DshConnectionError
} from "@effect-agent/builtin"

const refOf = (config: unknown): AdapterRef => ({ id: "dsh", kind: "test", config }) as unknown as AdapterRef

describe("dsh config resolution", () => {
  test("env overrides merge per-key over the host env (never whole-table)", () => {
    const config = resolveConfig(
      { env: { DSH_OVERRIDE: "from-options" } },
      refOf({ env: { DSH_OVERRIDE: "from-config", EXTRA: "x" } })
    )
    expect(config.env).toBeDefined()
    expect(config.env!["DSH_OVERRIDE"]).toBe("from-config") // config wins over options
    expect(config.env!["EXTRA"]).toBe("x")
    expect(config.env!["PATH"]).toBeDefined() // host env preserved (PATH survives the merge)
  })

  test("a non-string env override fails loud", () => {
    expect(() => resolveConfig({}, refOf({ env: { BAD: 42 } })))
      .toThrow(/dsh adapter: env override \"BAD\" must be a string \(got number\)/)
  })

  test("requestTimeoutMs: config wins over options", () => {
    const config = resolveConfig(
      { requestTimeoutMs: 100 },
      refOf({ requestTimeoutMs: 200 })
    )
    expect(config.requestTimeoutMs).toBe(200)
    expect(resolveConfig({}, refOf({})).requestTimeoutMs).toBeUndefined()
  })

  test("env does not participate in launch resolution", () => {
    const config = resolveConfig(
      { env: { DSH_ROOT: "/nowhere" } }, // env must not affect launch
      refOf({ launch: { command: "node", args: ["bin.js"] } })
    )
    expect(config.launch).toEqual({ command: "node", args: ["bin.js"] })
  })
})

describe("sdkLaunchOf", () => {
  test("strict launch shape with optional env/requestTimeoutMs passthrough", () => {
    expect(sdkLaunchOf({ launch: { command: "node", args: [] } }))
      .toEqual({ command: "node", args: [] })
    expect(sdkLaunchOf({
      launch: { command: "node", args: ["b"] },
      env: { A: "1" },
      requestTimeoutMs: 500
    })).toEqual({ command: "node", args: ["b"], env: { A: "1" }, requestTimeoutMs: 500 })
  })

  test("no launch fails loud (never a silent partial launch)", () => {
    expect(() => sdkLaunchOf({})).toThrow(/sdkLaunchOf requires a resolved launch/)
  })
})

describe("dsh.agent.run timeout budget", () => {
  test("a never-resolving run fails with code TIMEOUT inside the configured window", async () => {
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [dshConnectionSpec({ id: "dsh", adapters: [{ kind: "builtin.dsh" }] })],
      adapters: [dshSdkAdapter({
        requestTimeoutMs: 50,
        client: () => ({
          start: async () => {},
          run: () => new Promise(() => {}), // never resolves
          close: async () => {}
        })
      })]
    }))
    const started = Date.now()
    const failure = await Effect.runPromise(Effect.flip(
      runtime.invoke("dsh", DshCapabilities.agentRun, { prompt: "hi" })
    )) as DshConnectionError
    const elapsed = Date.now() - started
    expect(tagOf(failure)).toBe("DshConnectionError")
    expect(failure.code).toBe("TIMEOUT")
    expect(failure.message).toContain("dsh.agent.run timed out after 50ms")
    expect(elapsed).toBeGreaterThanOrEqual(40)
    expect(elapsed).toBeLessThan(5000)
    await Effect.runPromise(runtime.close("dsh"))
  })

  test("absent requestTimeoutMs keeps zero behavior change (run returns normally)", async () => {
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [dshConnectionSpec({ id: "dsh", adapters: [{ kind: "builtin.dsh" }] })],
      adapters: [dshSdkAdapter({
        client: () => ({
          start: async () => {},
          run: async (input) => ({ sessionId: "s", finalResponse: "echo: " + input, events: [] })
          , close: async () => {}
        })
      })]
    }))
    const result = await Effect.runPromise(runtime.invoke("dsh", DshCapabilities.agentRun, { prompt: "hi" }))
    expect(result).toEqual({ sessionId: "s", finalResponse: "echo: hi" })
    await Effect.runPromise(runtime.close("dsh"))
  })
})

const tagOf = (value: unknown): string | undefined =>
  "_tag" in (value as { _tag?: unknown }) ? (value as { _tag: string })._tag : undefined