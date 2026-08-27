import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  ConnectionRuntime,
  compile,
  connectionAdapter,
  type AgentIR,
  type ConnectionSpec
} from "@effect-agent/core"

const runCapability = {
  name: "agent.run",
  input: { type: "object" as const },
  output: { type: "string" as const },
  mode: "control" as const
}

const spec: ConnectionSpec = {
  id: "reasoning",
  contract: { capabilities: [runCapability] },
  adapters: [
    { kind: "offline", priority: 0 },
    { kind: "browser", priority: 1 }
  ],
  selection: { strategy: "failover" }
}

const ir: AgentIR = {
  input: { type: "string" },
  output: { type: "string" },
  connections: [{ ref: "reasoning", requires: ["agent.run"] }],
  entry: { connection: "reasoning", capability: "agent.run" }
}

describe("browser-safe connection kernel", () => {
  test("compiles an Agent as a connection graph and fails over adapters", async () => {
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [spec],
      adapters: [
        connectionAdapter({
          kind: "offline",
          capabilities: new Set(["agent.run"]),
          connect: () => Effect.fail(new Error("offline"))
        }),
        connectionAdapter({
          kind: "browser",
          capabilities: new Set(["agent.run"]),
          connect: (connection) => Effect.succeed({
            connectionId: connection.id,
            adapter: "browser",
            capabilities: new Set(["agent.run"]),
            invoke: (_capability, request) => Effect.succeed((request as any).input),
            close: Effect.void
          })
        })
      ]
    }))
    const program = await Effect.runPromise(compile(ir, runtime))
    expect(await Effect.runPromise(program.run("hello browser"))).toBe("hello browser")
    expect((await Effect.runPromise(runtime.open("reasoning"))).adapter).toBe("browser")
  })

  test("hot replacement closes the old adapter session", async () => {
    const closed: string[] = []
    const first = connectionAdapter({
      kind: "browser",
      capabilities: new Set(["agent.run"]),
      connect: (connection) => Effect.succeed({
        connectionId: connection.id,
        adapter: "browser",
        capabilities: new Set(["agent.run"]),
        invoke: () => Effect.succeed("v1"),
        close: Effect.sync(() => { closed.push("v1") })
      })
    })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({ specs: [{ ...spec, adapters: [{ kind: "browser" }] }], adapters: [first] }))
    expect(await Effect.runPromise(runtime.invoke("reasoning", "agent.run", {}))).toBe("v1")
    await Effect.runPromise(runtime.registerAdapter(connectionAdapter({
      kind: "browser",
      capabilities: new Set(["agent.run"]),
      connect: (connection) => Effect.succeed({
        connectionId: connection.id,
        adapter: "browser",
        capabilities: new Set(["agent.run"]),
        invoke: () => Effect.succeed("v2"),
        close: Effect.void
      })
    })))
    expect(closed).toEqual(["v1"])
    expect(await Effect.runPromise(runtime.invoke("reasoning", "agent.run", {}))).toBe("v2")
  })
})
