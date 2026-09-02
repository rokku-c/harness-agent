/**
 * Playground — L5 application example: assembles the five layers into a
 * runnable agent.
 *
 * Demonstrates "accumulation": the same definition swaps drivers, tools
 * come from the registry, memory is retrievable, the event log is
 * auditable, and answers are delivered via Delivery. All services come
 * from defaultLayers().
 */
import { Effect, Schema } from "effect"
import { Agent, AgentContext, Until, notationText, Op, type Binding } from "@effect-agent/core"
import { Harness } from "@effect-agent/core"
import { eventLogHook } from "@effect-agent/state"
import { Memory } from "@effect-agent/memory"
import { Delivery, Ingress } from "@effect-agent/channel"
import { ToolRegistry, tool, type ToolDescriptor } from "@effect-agent/tools"
import { assemble, driver } from "@effect-agent/assembly"

// ---- L1 capabilities (API-as-data): registry + bridged into core Bindings ----
const weatherTool: ToolDescriptor = tool({
  name: "weather.lookup",
  description: "look up weather for a city",
  inputSchema: { type: "object", properties: { city: { type: "string" } } },
  access: "read",
  execute: async (input) => {
    const city = String((input as { city: string }).city)
    return { city, temp: 24, condition: "sunny" }
  }
})

const noteBinding: Binding = {
  uri: "ea://notes/daily",
  ops: [
    Op.read({
      name: "read_notes",
      description: notationText("Read today's notes."),
      input: Schema.Void,
      output: Schema.Struct({ text: Schema.String }),
      execute: () => Effect.succeed({ text: "buy milk, ship release" })
    })
  ]
}

const main = Effect.gen(function* () {
  // ---- L4/L5 assembly: default composition (in-memory store / echo model / in-memory channel / allow-all gate) ----
  const registry = yield* ToolRegistry
  yield* registry.register(weatherTool)
  const bindings = yield* registry.asBindings()

  const effectAgent = yield* driver({ instructions: "You answer using tools and notes." })

  const Assistant = Agent
    .define("daily-bot", (task: string) => AgentContext.text(task))
    .returns(Until.text)
    .uses(noteBinding)
    .implementedBy(Harness.withHooks(effectAgent, eventLogHook("playground-session")))

  // ---- L3 execution ----
  const answer = yield* Assistant.run("weather in Shanghai + today's notes")

  // ---- L2 memory ----
  const memory = yield* Memory
  yield* memory.remember(String(answer), "answer", ["daily"], 1)

  // ---- L1 outbound delivery ----
  const delivery = yield* Delivery
  yield* delivery.send({ conversationId: "c1", text: String(answer) })

  // ---- observation ----
  const recalled = yield* memory.recall("notes")
  const sent = yield* delivery.history()
  const toolList = yield* registry.list()

  return {
    answer: String(answer),
    toolCount: toolList.length,
    recalled: recalled.map((r) => r.entry.content),
    delivered: sent.map((m) => m.text)
  }
})

// ---- run ----
const summary = await assemble().run(main)
console.log("=== playground agent ===")
console.log("answer:", summary.answer)
console.log("tools:", summary.toolCount)
console.log("recalled:", summary.recalled)
console.log("delivered:", summary.delivered)

// Proactive scenario: read Ingress (consumes a message if one is seeded)
const poll = Effect.gen(function* () {
  const ingress = yield* Ingress
  return yield* Effect.promise(() => ingress.read())
})
const message = await assemble().run(poll)
console.log("ingress:", message ?? "(idle)")
