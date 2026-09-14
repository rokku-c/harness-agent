import { Effect, Schema } from "effect"
import { Agent, AgentContext, Op, Until, notationText, type Binding } from "@effect-agent/core"
import { EffectAgent } from "@effect-agent/builtin"
import type { Model, WireMessage } from "@effect-agent/model"

const weather: Binding = {
  uri: "ea://svc/weather/main",
  ops: [Op.read({
    name: "lookup_weather",
    description: notationText("Look up the current weather for a city."),
    input: Schema.Struct({ city: Schema.String }),
    output: Schema.Struct({ temp: Schema.Number, condition: Schema.String }),
    execute: ({ city }) => Effect.succeed({ temp: 24, condition: "sunny" })
  })]
}

const model: Model = {
  generate: (_systemPrompt: string, messages: ReadonlyArray<WireMessage>) => {
    const first = messages.length <= 1
    return Effect.succeed(first
      ? { text: "", toolCalls: [{ id: "c1", name: "lookup_weather", input: { city: "Shanghai" } }] }
      : { text: "It is 24C and sunny in Shanghai.", toolCalls: [] })
  }
}

const Assistant = Agent
  .define("weather-assistant", (question: string) => AgentContext.text(question))
  .returns(Until.text)
  .uses(weather)
  .implementedBy(EffectAgent.make({ model, instructions: "You answer weather questions using your tools." }))

const answer = await Effect.runPromise(Assistant.run("What is the weather in Shanghai right now?"))
console.log("answer:", answer)

const Plan = Schema.Struct({ city: Schema.String, headline: Schema.String })
const Planner = Agent
  .define("weather-planner", (question: string) => AgentContext.text(question))
  .returns(Until.schema(Plan, { name: "submit_plan", description: "Return the completed plan" }))
  .implementedBy(EffectAgent.make({
    model: { generate: () => Effect.succeed({ text: "", toolCalls: [{
      id: "plan", name: "submit_plan", input: { city: "Shanghai", headline: "24C sunny" }
    }] }) }
  }))
const plan = await Effect.runPromise(Planner.run("summarize Shanghai weather"))
console.log("plan:", JSON.stringify(plan))
