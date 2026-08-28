/**
 * The ideal agent definition, per the owner's sketch - Effect-native:
 *   1. connections declared FIRST (six modes: any/named/shaped/named+shaped/cascade/notated)
 *   2. then the agent shape (prompt from notation, loop bound)
 *   3. agent dependencies - agents compose agents (an Agent is a Connection);
 *      child invokeMessage is an Effect, so composition is Effect composition
 * The base agent is the LLM: we never define a model, we adapt one in.
 *
 * Run: bun run examples/01-connections.ts
 */
import { Effect } from "effect"
import {
  any,
  cascade,
  connection,
  defineAgent,
  memoryNotationStore,
  named,
  resolveNotation,
  type Connection,
  type Llm,
  type NotationStore
} from "../src/index.ts"

// ── notation: all model-facing prose lives here ────────────────────────────
const store: NotationStore = memoryNotationStore([
  { target: "ops-lead/prompt", instructions: ["You lead operations. Ask the reviewer when unsure."] },
  { target: "reviewer/prompt", instructions: ["You review changes carefully."] }
])

// ── connections: the injectable units (execute returns an Effect) ──────────
const grafana = connection("grafana", [
  {
    name: "list_dashboards",
    input: { type: "object", properties: {} },
    output: { type: "array" },
    execute: () => Effect.succeed(["latency", "errors"])
  }
])
const stack = connection("stack", []) as Connection & { members?: Connection[] }
stack.members = [
  grafana,
  connection("prometheus", [
    { name: "query", input: { type: "object" }, output: { type: "string" }, execute: () => Effect.succeed("up") }
  ])
]
const github = connection("github", [
  {
    name: "list_prs",
    input: { type: "object", properties: {} },
    output: { type: "array" },
    execute: () => Effect.succeed(["#1", "#2"])
  }
])

// ── agent dependencies: an agent uses other agents to build itself up ──────
const reviewer = defineAgent({
  name: "reviewer",
  connections: {}, // this agent takes no tool connections
  prompt: { store, target: "reviewer/prompt" },
  maxSteps: 4
}, scriptedLlm("reviewer", ["looks good"]))

// ── the definition: connections first, then the shape ──────────────────────
const opsLead = defineAgent({
  name: "ops-lead",
  connections: {
    dashboards: named("grafana"), // mode 2: named -> "grafana__" tool prefix
    monitoring: any(),            // mode 1: any -> "mcp__" prefix (MCP-like)
    stack: cascade([])            // mode 3: a connection of connections
  },
  agents: [reviewer],             // agent dependency: reviewer__invokeMessage
  prompt: { store, target: "ops-lead/prompt" }, // mode 6: notated
  maxSteps: 8
}, scriptedLlm("ops-lead", [
  { text: "asking the reviewer", toolCalls: [{ id: "1", name: "reviewer__invokeMessage", input: { message: "review the dashboards" } }] },
  { text: "reviewer says: looks good", toolCalls: [] }
]))

// ── runtime injection: bind connections (real-time, re-bindable) ───────────
opsLead.applyTools([stack, grafana, github])
console.log(resolveNotation(store, "ops-lead/prompt"))

const program = Effect.flatMap(opsLead.invokeMessage("how are the dashboards?"), (reply) =>
  Effect.sync(() => {
    console.log("reply:", reply)
    console.log("lead turns:", opsLead.listTurns().length, "| child messages:", reviewer.listMessages().length)
  }))

await Effect.runPromise(program)

// ── the scripted LLM (stand-in for a real model adapter) ───────────────────
function scriptedLlm(
  name: string,
  replies: Array<string | { text: string; toolCalls: Array<{ id: string; name: string; input: unknown }> }>
): Llm {
  const queue = [...replies]
  return {
    generate: () => {
      const next = queue.shift()
      if (next === undefined) throw new Error(`scripted llm "${name}" exhausted`)
      return Effect.succeed(typeof next === "string" ? { text: next, toolCalls: [] } : next)
    }
  }
}
