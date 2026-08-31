/**
 * Live model: the architecture + a built-in provider connection. Gated on
 * OPENAI_API_KEY - without a key it prints a hint and exits cleanly.
 *
 * Run: OPENAI_API_KEY=sk-... bun run examples/02-live-llm.ts
 */
import { Effect } from "effect"
import { any, architect, inject, named, memoryNotationStore, openaiProvider } from "../src/index.ts"

const apiKey = process.env.OPENAI_API_KEY
if (apiKey === undefined) {
  console.log("set OPENAI_API_KEY to run this example against a live model")
  process.exit(0)
}

const notation = memoryNotationStore([
  { target: "assistant/prompt", instructions: ["You are a terse assistant. Answer in one sentence."] }
])

const assistant = architect({
  name: "assistant",
  connections: { web: any() },
  prompt: "assistant/prompt"
})

const model = openaiProvider({
  apiKey,
  model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  baseUrl: process.env.OPENAI_BASE_URL
})

const program = Effect.gen(function* () {
  const agent = yield* inject(assistant, { notation, model, connections: [] })
  const reply = yield* agent.invokeMessage("What is the capital of France?")
  console.log("reply:", reply)
})

await Effect.runPromise(program)
