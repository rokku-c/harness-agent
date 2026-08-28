import { describe, expect, test } from "bun:test"
import { Chunk, Effect, Exit, Fiber, Option, Stream } from "effect"
import {
  ConnectionOpenError,
  ConnectionRuntime,
  compile,
  connectionAdapter,
  type AgentIR,
  type ConnectionEvent,
  type ConnectionSession,
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
describe("open single-flight", () => {
  const sfAdapter = (gate: { connects: number }) => connectionAdapter({
    kind: "sf-browser",
    capabilities: new Set(["agent.run"]),
    connect: (connection) => Effect.sync(() => { gate.connects++ }).pipe(Effect.as({
      connectionId: connection.id,
      adapter: "sf-browser",
      capabilities: new Set(["agent.run"]),
      invoke: () => Effect.succeed("ok"),
      close: Effect.void
    }))
  })

  test("N concurrent opens of the same id connect once and share one session", async () => {
    const gate = { connects: 0 }
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [{ ...spec, id: "sf", adapters: [{ kind: "sf-browser" }] }],
      adapters: [sfAdapter(gate)]
    }))
    const sessions = await Promise.all([
      Effect.runPromise(runtime.open("sf")),
      Effect.runPromise(runtime.open("sf")),
      Effect.runPromise(runtime.open("sf"))
    ])
    expect(gate.connects).toBe(1)
    expect(sessions[0]).toBe(sessions[1])
    expect(sessions[1]).toBe(sessions[2])
    const state = await Effect.runPromise(runtime.snapshot())
    expect(state.sessions.size).toBe(1)
    expect(state.pending.size).toBe(0)
  })

  test("concurrent opens emit exactly one connection.opened", async () => {
    const gate = { connects: 0 }
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [{ ...spec, id: "sf2", adapters: [{ kind: "sf-browser" }] }],
      adapters: [sfAdapter(gate)]
    }))
    const result = await Effect.runPromise(Effect.gen(function* () {
      const collector = yield* Stream.runCollect(Stream.take(runtime.events(), 1)).pipe(Effect.fork)
      yield* Effect.sleep(5)
      yield* Effect.fork(runtime.open("sf2"))
      yield* Effect.fork(runtime.open("sf2"))
      const session = yield* runtime.open("sf2")
      const chunk = yield* Fiber.join(collector)
      // Wait a window afterwards: a second connection.opened would have shown up.
      yield* Effect.sleep(50)
      const extra = yield* Stream.runCollect(Stream.take(runtime.events(), 1)).pipe(Effect.timeoutOption(20))
      return { session, opened: [...chunk].map((event) => event.kind), extra }
    }) as Effect.Effect<{ session: ConnectionSession; opened: string[]; extra: Option.Option<Chunk.Chunk<ConnectionEvent>> }, Error, never>)
    expect(result.opened).toEqual(["connection.opened"])
    expect(result.extra._tag).toBe("None")
    expect(result.session.adapter).toBe("sf-browser")
    expect(gate.connects).toBe(1)
  })

  test("a failed first open lets a later open retry the whole chain", async () => {
    const gate = { connects: 0 }
    const adapter = connectionAdapter({
      kind: "browser",
      capabilities: new Set(["agent.run"]),
      connect: (connection) => Effect.sync(() => { gate.connects++ }).pipe(
        Effect.flatMap(() => gate.connects === 1
          ? Effect.fail(new Error("first attempt boom"))
          : Effect.succeed({ connectionId: connection.id, adapter: "browser", capabilities: new Set(["agent.run"]), invoke: () => Effect.succeed("ok"), close: Effect.void })))
    })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [{ ...spec, id: "retry", adapters: [{ kind: "browser" }] }],
      adapters: [adapter]
    }))
    const failure = await Effect.runPromise(Effect.flip(runtime.open("retry")))
    expect(failure).toBeInstanceOf(ConnectionOpenError)
    const session = await Effect.runPromise(runtime.open("retry"))
    expect(session.adapter).toBe("browser")
    expect(gate.connects).toBe(2)
    const state = await Effect.runPromise(runtime.snapshot())
    expect(state.pending.size).toBe(0)
  })

  test("interrupting the owner fails the waiter and clears pending for a later retry", async () => {
    let connectStarted = false
    let releaseConnect: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { releaseConnect = resolve })
    let connects = 0
    const adapter = connectionAdapter({
      kind: "browser",
      capabilities: new Set(["agent.run"]),
      connect: (connection) => Effect.gen(function* () {
        connects++
        connectStarted = true
        yield* Effect.async<void>((resume) => { void gate.then(() => resume(Effect.succeed(undefined))) })
        return { connectionId: connection.id, adapter: "browser", capabilities: new Set(["agent.run"]), invoke: () => Effect.succeed("ok"), close: Effect.void }
      })
    })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      specs: [{ ...spec, id: "int", adapters: [{ kind: "browser" }] }],
      adapters: [adapter]
    }))
    // Fork + interrupt + join must live in one effect: a forked fiber is not a
    // daemon, so exiting the forking fiber interrupts it before connect() runs.
    const result = await Effect.runPromise(Effect.gen(function* () {
      const owner = yield* Effect.fork(runtime.open("int"))
      while (!connectStarted) yield* Effect.sleep(5)
      const waiter = yield* Effect.fork(runtime.open("int"))
      yield* Effect.sleep(10)
      yield* Fiber.interrupt(owner)
      const waiterExit = yield* waiter.await
      let state = yield* runtime.snapshot()
      const pendingAfterInterrupt = state.pending.size
      // A later open retries the chain and succeeds once the gate is released.
      releaseConnect?.()
      const session = yield* runtime.open("int")
      state = yield* runtime.snapshot()
      return {
        waiterFailed: Exit.isFailure(waiterExit),
        pendingAfterInterrupt,
        adapter: session.adapter,
        connects,
        sessionsSize: state.sessions.size,
        pendingAfterRetry: state.pending.size
      }
    }) as Effect.Effect<{ waiterFailed: boolean; pendingAfterInterrupt: number; adapter: string; connects: number; sessionsSize: number; pendingAfterRetry: number }, Error, never>)
    expect(result.waiterFailed).toBe(true)
    expect(result.pendingAfterInterrupt).toBe(0)
    expect(result.adapter).toBe("browser")
    expect(result.connects).toBe(2)
    expect(result.sessionsSize).toBe(1)
    expect(result.pendingAfterRetry).toBe(0)
  })
})