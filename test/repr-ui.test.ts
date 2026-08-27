import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { ConnectionRuntime, connectionAdapter } from "@effect-agent/core"
import { coreEndpoint, endpointTransport, trustedCorePolicy } from "@effect-agent/builtin"
import { ReprRuntime } from "@effect-agent/repr"
import { createTui, renderTui } from "@effect-agent/tui"

const makeRepr = () => Effect.gen(function* () {
  const core = yield* ConnectionRuntime.make({
    specs: [{
      id: "workspace",
      contract: {
        protocol: "test/v1",
        capabilities: [{ name: "read", input: {}, output: {} }]
      },
      adapters: [{ kind: "memory" }]
    }],
    adapters: [connectionAdapter({
      kind: "memory",
      capabilities: new Set(["read"]),
      connect: (spec) => Effect.succeed({
        connectionId: spec.id,
        adapter: "memory",
        capabilities: new Set(["read"]),
        invoke: (_capability, input) => Effect.succeed(input),
        close: Effect.void
      })
    })]
  })
  return yield* ReprRuntime.connect(endpointTransport(coreEndpoint(core, trustedCorePolicy)), { eventLimit: 8 })
})

describe("shared Repr", () => {
  test("drives the compact TUI and records Core events", async () => {
    const program = Effect.gen(function* () {
      const repr = yield* makeRepr()
      const initial = yield* repr.snapshot
      const tui = createTui(repr, { columns: 76, rows: 20 })
      const firstFrame = yield* tui.frame
      yield* repr.dispatch({ type: "invoke", connection: "workspace", capability: "read", input: "README" })
      yield* Effect.sleep("5 millis")
      const current = yield* repr.snapshot
      yield* repr.close
      return { initial, firstFrame, current }
    })
    const { initial, firstFrame, current } = await Effect.runPromise(program)
    expect(initial.connections.map((connection) => connection.id)).toEqual(["workspace"])
    expect(firstFrame).toContain("EVENT LEDGER")
    expect(firstFrame).toContain("workspace")
    expect(current.events.some((event) => event.kind === "connection.invoked")).toBe(true)
    expect(current.invocations.workspace).toMatchObject({
      capability: "read",
      status: "succeeded",
      output: "README"
    })
  })

  test("TUI uses the same snapshot without platform state", () => {
    const output = renderTui({
      revision: 3,
      filter: "",
      selected: "agent",
      connections: [{ id: "agent", protocol: "agent/v1", capabilities: [
        { name: "run", input: { type: "object" }, output: { type: "string" }, mode: "control" },
        { name: "cancel", input: {}, output: {}, mode: "control" }
      ], status: "active" }],
      events: [{ sequence: 1, connectionId: "agent", adapter: "direct", kind: "connection.opened" }],
      invocations: {
        agent: { connection: "agent", capability: "run", status: "succeeded", input: {}, output: "done" }
      }
    }, { columns: 64, rows: 16 })
    expect(output.split("\n")).toHaveLength(16)
    expect(output).toContain("j/k select")
    expect(output).toContain("done")
    expect(output).toContain("input")
  })
})
