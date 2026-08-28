/**
 * Live LLM round: the rewrite's loop against a REAL model (gated on env - the
 * example prints how to run it and exits cleanly when no key is present).
 *
 *   OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4o-mini bun run examples/02-live-llm.ts
 *   # or any compatible host:
 *   OPENAI_API_KEY=... OPENAI_BASE_URL=https://api.deepseek.com/v1 OPENAI_MODEL=deepseek-chat bun run examples/02-live-llm.ts
 */
import { Effect } from "effect"
import { any, connection, defineAgent, memoryNotationStore, openaiLlm } from "../src/index.ts"

const apiKey = process.env.OPENAI_API_KEY
if (apiKey === undefined) {
  console.log("set OPENAI_API_KEY (and optionally OPENAI_BASE_URL / OPENAI_MODEL) to run the live round")
  process.exit(0)
}

const store = memoryNotationStore([
  { target: "weather-assistant/prompt", instructions: ["Answer with one sentence. Use the lookup tool; never guess the weather."] },
  { target: "tool:lookup_weather", instructions: ["Look up the current weather for a city."] }
])

const weather = connection("weather", [
  {
    name: "lookup_weather",
    input: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
    output: { type: "object" },
    execute: (input) => Effect.succeed({ city: (input as { city: string }).city, temperature: 24, condition: "sunny" })
  }
])

const assistant = defineAgent({
  name: "weather-assistant",
  connections: { mcp: any() }, // any-mode: the MCP-like prefix slot
  prompt: { store, target: "weather-assistant/prompt" },
  maxSteps: 4
}, openaiLlm({
  apiKey,
  model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  baseUrl: process.env.OPENAI_BASE_URL
}))

assistant.applyTools([connection("anything", [weather.tools[0]!], store)])

await Effect.runPromise(Effect.flatMap(assistant.invokeMessage("What is the weather in Shanghai right now?"), (reply) =>
  Effect.sync(() => {
    console.log("reply:", reply)
    console.log("turn:", assistant.listTurns()[0]?.messages.length, "messages in the log")
  })))
