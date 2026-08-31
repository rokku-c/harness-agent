/**
 * LIVE: the architecture + the real provider connection from .env
 * (LLM_API_KEY against the anthropic-messages gateway). Gated on the key.
 *
 * Run: bun run examples/02-live-llm.ts
 */
import { Effect } from "effect"
import { anthropicProvider, architect, connection, inject, memoryNotationStore, named } from "../src/index.ts"

// bun auto-loads .env - the same provider key the earlier config used
const apiKey = process.env.LLM_API_KEY
if (apiKey === undefined) {
  console.log("set LLM_API_KEY (see .env) to run this example against the live provider")
  process.exit(0)
}

const notation = memoryNotationStore([
  { target: "weather-assistant/prompt", instructions: [
    "You are a terse weather assistant.",
    "Use the lookup tool for city questions; answer in one sentence."
  ] }
])

const weather = connection("weather", [{
  name: "lookup",
  input: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
  output: { type: "object" },
  execute: (input: unknown) => {
    const { city } = input as { city: string }
    return Effect.succeed({ city, temperature: 24, condition: "sunny" })
  }
}])

const weatherAssistant = architect({
  name: "weather-assistant",
  connections: { sky: named("weather") },
  prompt: "weather-assistant/prompt"
})

const model = anthropicProvider({
  apiKey,
  model: process.env.LLM_MODEL ?? "deepseek-v4-flash",
  baseUrl: process.env.LLM_BASE_URL ?? "https://ai-api-gateway.app.baizhiyun.vip/api/anthropic"
})

const program = Effect.gen(function* () {
  const agent = yield* inject(weatherAssistant, { notation, model, connections: [weather] })
  const reply = yield* agent.invokeMessage("What is the weather in Shanghai right now?")
  console.log("reply:", reply)
  const messages = yield* agent.listMessages
  for (const message of messages)
    console.log(" ", message.role, message.role === "tool" ? `${message.name}: ${message.content}` : message.content)
})

await Effect.runPromise(program).catch((cause) => {
  console.error("live run failed:", cause)
  process.exit(1)
})
