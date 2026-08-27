import { describe, expect, test } from "bun:test"
import { Effect, Fiber, Stream } from "effect"
import {
  ConnectionOpenError,
  ConnectionRuntime,
  compile,
  connectionAdapter,
  type AgentIR,
  type ConnectionEvent,
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
describe("closeSessions failure containment", () => {
  test("a failing session close is reported and does not abort the sweep", async () => {
    const browser = connectionAdapter({
      kind: "browser",
      capabilities: new Set(["agent.run"]),
      connect: (connection) => Effect.succeed({
        connectionId: connection.id,
        adapter: "browser",
        capabilities: new Set(["agent.run"]),
        invoke: () => Effect.succeed("ok"),
        close: connection.id === "good" ? Effect.void : Effect.fail(new Error("close boom"))
      })
    })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [
        { ...spec, id: "good", adapters: [{ kind: "browser" }] },
        { ...spec, id: "bad", adapters: [{ kind: "browser" }] }
      ],
      adapters: [browser]
    }))
    const events = await Effect.runPromise(
      Effect.gen(function* () {
        // Subscribe before the operations: Stream.fromPubSub subscribes lazily,
        // so the collector must be running before the events are published.
        const collector = yield* Stream.runCollect(Stream.take(runtime.events(), 4)).pipe(Effect.fork)
        // Let the collector's subscription land before publishing (PubSub does
        // not replay messages published before a subscriber attaches).
        yield* Effect.sleep(5)
        yield* runtime.open("good")
        yield* runtime.open("bad")
        yield* runtime.registerAdapter(connectionAdapter({
          kind: "browser",
          capabilities: new Set(["agent.run"]),
          connect: (connection) => Effect.succeed({
            connectionId: connection.id,
            adapter: "browser",
            capabilities: new Set(["agent.run"]),
            invoke: () => Effect.succeed("v2"),
            close: Effect.void
          })
        }))
        const chunk = yield* Fiber.join(collector)
        return [...chunk]
      }) as Effect.Effect<ConnectionEvent[], Error, never>
    )
    const kinds = events.map((event) => event.kind)
    expect(kinds).toContain("connection.closed")
    expect(kinds).toContain("connection.failed")
    const closed = events.filter((event) => event.kind === "connection.closed").map((event) => event.connectionId)
    expect(closed).toContain("good")
    expect(closed).not.toContain("bad")
    const failed = events.find((event) => event.kind === "connection.failed")
    expect(failed?.connectionId).toBe("bad")
    const payload = (failed?.payload ?? {}) as { operation?: string; cause?: { message?: string } }
    expect(payload.operation).toBe("close")
    expect(payload.cause?.message).toContain("close boom")
    // the bad session was still reaped from the runtime state
    expect(await Effect.runPromise(runtime.open("bad").pipe(Effect.map((session) => session.adapter)))).toBe("browser")
  })
})

describe("open attempt recording", () => {
  test("capability-missing adapters are recorded in attempts with the missing capability", async () => {
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [{
        id: "impossible",
        contract: { capabilities: [runCapability, { name: "agent.teleport", input: { type: "object" as const }, output: { type: "string" as const }, mode: "control" as const }] },
        adapters: [{ kind: "offline", priority: 0 }, { kind: "browser", priority: 1 }],
        selection: { strategy: "failover" }
      }],
      adapters: [
        connectionAdapter({ kind: "offline", capabilities: new Set(["agent.run"]), connect: () => Effect.fail(new Error("unused")) }),
        connectionAdapter({ kind: "browser", capabilities: new Set(["agent.run"]), connect: () => Effect.fail(new Error("unused")) })
      ]
    }))
    const failure = await Effect.runPromise(Effect.flip(runtime.open("impossible")))
    expect(failure).toBeInstanceOf(ConnectionOpenError)
    const err = failure as unknown as ConnectionOpenError
    expect(err.attempts.length).toBe(2)
    for (const attempt of err.attempts) {
      const cause = attempt.cause as { _tag?: string; capability?: string; adapter?: string }
      expect(cause._tag).toBe("ConnectionCapabilityUnavailable")
      expect(cause.capability).toBe("agent.teleport")
      expect(["offline", "browser"]).toContain(cause.adapter ?? "")
    }
  })
})