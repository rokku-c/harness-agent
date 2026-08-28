import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { BehaviorRegistry, compileBehavior, parseBehaviorSpec, type OutputOf } from "../src/ir.js"
import { ConnectionRuntime, connectionAdapter } from "@effect-agent/core"
import { ConnectionRegistry, mcpConnection } from "../src/connections.js"
import type { Driver } from "../src/core.js"

const driver: Driver = {
  id: "fake",
  capabilities: {
    provider: { _tag: "Fixed", api: "test" as const }, granularity: "run" as const,
    thinking: false, cancel: false, pause: false, resume: false, fork: "none" as const,
    tools: "none" as const, toolCalls: "none" as const, structuredOutput: "none" as const, sandbox: "none" as const
  },
  run: <A, R>() => Effect.succeed("ok" as A)
}

describe("declarative BehaviorSpec", () => {
  test("parses JSON and compiles behavior through injection", async () => {
    const spec = parseBehaviorSpec("json", JSON.stringify({ id: "demo", behavior: "fake", output: { kind: "stop" } }))
    const connections = await Effect.runPromise(ConnectionRuntime.make())
    const program = await Effect.runPromise(compileBehavior(spec, {
      connections,
      behaviors: BehaviorRegistry.make([{ ref: "fake", create: () => Effect.succeed(driver) }])
    }))
    expect(await Effect.runPromise(program.run("hello"))).toBe("ok")
  })

  test("an invalid output.kind fails compile with a directed error", async () => {
    const spec = parseBehaviorSpec("json", JSON.stringify({ id: "bad", behavior: "fake", output: { kind: "bogus" } }))
    const connections = await Effect.runPromise(ConnectionRuntime.make())
    const program = compileBehavior(spec, {
      connections,
      behaviors: BehaviorRegistry.make([{ ref: "fake", create: () => Effect.succeed(driver) }])
    })
    await expect(Effect.runPromise(program)).rejects.toThrow(/output.kind "bogus" is unsupported/)
  })

  // Type-level pin (enforced by tsc): OutputOf mirrors untilOf's output universe.
  const _textOut: OutputOf<{ id: "t"; output: { kind: "text" }; behavior: "b" }> = "final text"
  const _stopOut: OutputOf<{ id: "s"; output: { kind: "stop" }; behavior: "b" }> = "final text"
  const _thinkOut: OutputOf<{ id: "h"; output: { kind: "thinking" }; behavior: "b" }> = "final text"
  const _toolOut: OutputOf<{ id: "c"; output: { kind: "toolCall" }; behavior: "b" }> = { _tag: "ToolCall", id: "1", name: "n", input: {} }
  const _schemaOut: OutputOf<{ id: "sc"; output: { kind: "schema"; schema: { type: "object" } }; behavior: "b" }> = { any: "unknown today" }

  test("MCP connections can be hot-plugged and removed", async () => {
    const closed: string[] = []
    const connection = mcpConnection({ id: "tools", request: (method) => method === "tools/list"
      ? Promise.resolve({ tools: [{ name: "echo" }] })
      : Promise.resolve({ content: [{ type: "text", text: "ok" }] }) })
    const registry = ConnectionRegistry.empty.register({ ...connection, close: () => Effect.sync(() => { closed.push("tools") }) })
    expect((await Effect.runPromise(registry.listTools("tools"))).map((tool) => tool.name)).toEqual(["echo"])
    const removed = registry.unregister("tools")
    await Effect.runPromise(removed.closed)
    expect(closed).toEqual(["tools"])
    expect(removed.registry.list()).toHaveLength(0)
  })

  test("one logical connection supports adapter failover and hot replacement", async () => {
    const unavailable = connectionAdapter({
      kind: "unavailable",
      capabilities: new Set(["tools.call"]),
      connect: () => Effect.fail(new Error("offline"))
    })
    const local = connectionAdapter({
      kind: "local",
      capabilities: new Set(["tools.call"]),
      connect: (spec) => Effect.succeed({
        connectionId: spec.id,
        adapter: "local",
        capabilities: new Set(["tools.call"]),
        invoke: (capability, input) => Effect.succeed({ capability, input }),
        close: Effect.void
      })
    })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({ adapters: [unavailable] }))
    await Effect.runPromise(runtime.registerSpec({
      id: "workspace",
      contract: { capabilities: [{ name: "tools.call", input: {}, output: {} }] },
      adapters: [{ kind: "unavailable", priority: 0 }, { kind: "local", priority: 1 }],
      selection: { strategy: "failover" }
    }))
    await Effect.runPromise(runtime.registerAdapter(local))
    expect(await Effect.runPromise(runtime.invoke("workspace", "tools.call", { path: "." })))
      .toEqual({ capability: "tools.call", input: { path: "." } })
    expect((await Effect.runPromise(runtime.open("workspace"))).adapter).toBe("local")
  })
})
