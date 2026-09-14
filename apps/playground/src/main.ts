import { Effect, Schema } from "effect"
import { Agent, AgentContext, Until, notationText, Op, type Binding } from "@effect-agent/core"
import { Harness } from "@effect-agent/core"
import { eventLogHook } from "@effect-agent/state"
import { Memory } from "@effect-agent/memory"
import { Delivery, Ingress } from "@effect-agent/channel"
import { ToolRegistry, tool, type ToolDescriptor } from "@effect-agent/tools"
import { assemble, driver } from "@effect-agent/assembly"

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
  const registry = yield* ToolRegistry
  yield* registry.register(weatherTool)
  const bindings = yield* registry.asBindings()

  const effectAgent = yield* driver({ instructions: "You answer using tools and notes." })

  const Assistant = Agent
    .define("daily-bot", (task: string) => AgentContext.text(task))
    .returns(Until.text)
    .uses(noteBinding)
    .implementedBy(Harness.withHooks(effectAgent, eventLogHook("playground-session")))

  const answer = yield* Assistant.run("weather in Shanghai + today's notes")

  const memory = yield* Memory
  yield* memory.remember(String(answer), "answer", ["daily"], 1)

  const delivery = yield* Delivery
  yield* delivery.send({ conversationId: "c1", text: String(answer) })

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

const summary = await assemble().run(main)
console.log("=== playground agent ===")
console.log("answer:", summary.answer)
console.log("tools:", summary.toolCount)
console.log("recalled:", summary.recalled)
console.log("delivered:", summary.delivered)

const poll = Effect.gen(function* () {
  const ingress = yield* Ingress
  return yield* Effect.promise(() => ingress.read())
})
const message = await assemble().run(poll)
console.log("ingress:", message ?? "(idle)")
