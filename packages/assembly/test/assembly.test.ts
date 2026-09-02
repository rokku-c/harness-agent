import { describe, expect, it } from "bun:test"
import { Effect, Schema } from "effect"
import { Agent, AgentContext, Until, notationText, Op, type Binding } from "@effect-agent/core"
import { Delivery, Ingress } from "@effect-agent/channel"
import { EventLog, Store } from "@effect-agent/state"
import { ToolRegistry } from "@effect-agent/tools"
import { assemble, defaultLayers, driver } from "@effect-agent/assembly"

describe("assembly", () => {
  it("defaultLayers provides every seam; an agent runs and delivers", async () => {
    // a capability: read-only op served by a binding
    const notes: Binding = {
      uri: "ea://notes/daily",
      ops: [
        Op.read({
          name: "read_notes",
          description: notationText("Read today's notes."),
          input: Schema.Void,
          output: Schema.Struct({ text: Schema.String }),
          execute: () => Effect.succeed({ text: "note: buy milk" })
        })
      ]
    }

    const program = Effect.gen(function* () {
      // 1. build the default driver with the model from context
      const effectAgent = yield* driver({ instructions: "You summarize." })
      // 2. define the agent once, access the notes binding
      const Assistant = Agent
        .define("notes", (task: string) => AgentContext.text(task))
        .returns(Until.text)
        .uses(notes)
        .implementedBy(effectAgent)
      // 3. run it
      const answer = yield* Assistant.run("what are my notes?")
      // 4. deliver the answer
      const delivery = yield* Delivery
      yield* delivery.send({ conversationId: "c1", text: String(answer) })
      return answer
    })

    // one assembled instance: the same MemoryChannel across runs
    const app = assemble()
    const answer = await app.run(program)
    expect(String(answer)).toContain("note")

    // delivery recorded the message (same channel instance)
    const sent = await app.run(
      Effect.gen(function* () {
        const delivery = yield* Delivery
        return yield* delivery.history()
      })
    )
    expect(sent).toHaveLength(1)
    expect(sent[0]!.text).toBe(String(answer))
  })

  it("store and eventlog are present in the default assembly", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* Store
        const log = yield* EventLog
        yield* store.put("k", { type: "note", text: "v" })
        yield* log.append("s", "test.event", { ok: true })
        return { stored: yield* store.get("k"), events: yield* log.all() }
      }).pipe(Effect.provide(defaultLayers()))
    )
    expect(result.stored).toEqual({ type: "note", text: "v" })
    expect(result.events).toHaveLength(1)
  })

  it("swapping the model changes the driver surface (M1)", async () => {
    const program = Effect.gen(function* () {
      const effectAgent = yield* driver()
      const AgentProgram = Agent
        .define("echo", (input: string) => AgentContext.text(input))
        .returns(Until.text)
        .implementedBy(effectAgent)
      return yield* AgentProgram.run("hello")
    })
    const withEcho = await assemble().run(program)
    expect(String(withEcho)).toContain("hello")
    const withStub = await assemble({
      model: { id: "stub", capabilities: {}, generate: () => Effect.succeed({ text: "stubbed", toolCalls: [] }) }
    }).run(program)
    expect(String(withStub)).toBe("stubbed")
  })
})
