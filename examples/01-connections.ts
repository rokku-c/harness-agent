/**
 * The agent architecture: define what the agent IS (its connections, its
 * composition, its prompt as a notation target), then inject the notation -
 * and the architecture becomes a truly executable agent.
 *
 * Run: bun run examples/01-connections.ts
 */
import { Effect } from "effect"
import {
  any, architect, cascade, connection, inject, named, notated,
  memoryNotationStore, type Connection, type GenerateResult
} from "../src/index.ts"

// ── runtime connections (the pool the architecture's slots bind from) ──
const dashboards = connection("grafana", [
  {
    name: "list_dashboards",
    input: { type: "object", properties: {} },
    output: { type: "object" },
    execute: () => Effect.succeed({ dashboards: ["latency", "errors"] })
  }
])
const monitoring = connection("prometheus", [
  {
    name: "query",
    input: { type: "object", properties: { q: { type: "string" } } },
    output: { type: "object" },
    execute: () => Effect.succeed({ value: 0.42 })
  }
])
const github = connection("github", [
  {
    name: "create_issue",
    input: { type: "object", properties: { title: { type: "string" } } },
    output: { type: "object" },
    execute: () => Effect.succeed({ issue: 17 })
  }
])
const stack = connection("stack", [], memoryNotationStore([
  { target: "tool:create_issue", instructions: ["File ONE issue per incident; link the dashboard in the body."] }
])) as Connection & { members?: ReadonlyArray<Connection> }
stack.members = [dashboards, github]

// ── the notation: the prose layer, injected at activation ──
const notation = memoryNotationStore([
  { target: "reviewer/prompt", instructions: ["You review incidents calmly and cite evidence."] },
  { target: "ops-lead/prompt", instructions: ["You are the operations lead. Check dashboards before escalating."] },
  { target: "var:team", instructions: ["platform-infra"] }
])

// ── a scripted provider connection (swap openaiProvider(...) in for real) ──
const scriptedProvider = (script: GenerateResult[]): Connection => {
  const queue = [...script]
  return {
    name: "scripted",
    tools: [],
    generate: () => Effect.succeed(queue.shift() ?? { text: "done", toolCalls: [] })
  }
}

// ── 1. the architectures: inert blueprints ──
const reviewer = architect({
  name: "reviewer",
  connections: {},
  prompt: "reviewer/prompt"
})

const opsLead = architect({
  name: "ops-lead",
  connections: {
    dashboards: named("grafana"),
    monitoring: any(),
    stack: cascade([])
  },
  agents: [reviewer],
  prompt: "ops-lead/prompt"
})

// ── 2. the injection: notation + provider + connections → executable agent ──
const model = scriptedProvider([
  { text: "", toolCalls: [{ id: "1", name: "grafana__list_dashboards", input: {} }] },
  { text: "", toolCalls: [{ id: "2", name: "stack__github__create_issue", input: { title: "latency spike" } }] },
  { text: "", toolCalls: [{ id: "3", name: "reviewer__invokeMessage", input: { message: "review the incident" } }] },
  { text: "reviewed.", toolCalls: [] },
  { text: "incident filed and reviewed.", toolCalls: [] }
])

const program = Effect.gen(function* () {
  const lead = yield* inject(opsLead, {
    notation,
    model,
    connections: [dashboards, monitoring, github, stack]
  })

  const reply = yield* lead.invokeMessage("latency is spiking on prod")
  console.log("reply:", reply)

  const turns = yield* lead.listTurns
  console.log("turns:", turns.length, "status:", turns[0]?.status)

  const messages = yield* lead.listMessages
  for (const message of messages) console.log(" ", message.role, message.role === "tool" ? `${message.name}: ${message.content}` : message.content)

  // real-time rebind: the pool can change between invocations
  yield* lead.applyTools([dashboards, github, stack])
  const rebound = yield* lead.invokeMessage("and now?")
  console.log("after rebind:", rebound)
})

await Effect.runPromise(program)
