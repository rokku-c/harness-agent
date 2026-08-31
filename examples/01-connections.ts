/**
 * The agent architecture: define what the agent IS (its connections, its
 * composition, its prompt as a notation target), then inject the notation -
 * and the architecture becomes a truly executable agent.
 *
 * Demonstrated: named / any / cascade / notated slots, {var} interpolation,
 * agent composition (architectures mix-build), real-time rebind.
 *
 * Run: bun run examples/01-connections.ts
 */
import { Effect } from "effect"
import {
  any, architect, bind, cascade, connection, inject, named, notated,
  memoryNotationStore, type Connection, type GenerateResult
} from "@effect-agent/core"

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
const stack = connection("stack", []) as Connection & { members?: ReadonlyArray<Connection> }
stack.members = [dashboards, github]

// mode 6 (notated): the tool carries NO inline description - the connection's
// own store resolves "tool:search_notes" at bind time
const notes = connection("docs", [
  {
    name: "search_notes",
    input: { type: "object", properties: { q: { type: "string" } } },
    output: { type: "object" },
    execute: () => Effect.succeed({ hits: ["2026-08-12: latency incident postmortem"] })
  }
], memoryNotationStore([
  { target: "tool:search_notes", instructions: ["Search past incident notes for history and postmortems."] }
]))

// ── the notation: the prose layer, injected at activation ──
const notation = memoryNotationStore([
  { target: "reviewer/prompt", instructions: ["You review incidents calmly and cite evidence."] },
  { target: "ops-lead/prompt", instructions: [
    "You are the operations lead for the {team} team.",
    "Check dashboards before escalating; search the notes for history."
  ] }
])

// ── a scripted provider connection (swap openaiProvider/anthropicProvider in for real) ──
const scriptedProvider = (script: GenerateResult[]): Connection => {
  const queue = [...script]
  return {
    name: "scripted",
    tools: [],
    generate: () => Effect.succeed(queue.shift() ?? { text: "done", toolCalls: [] })
  }
}

// ── 1. the architectures: inert blueprints (pure data - no code allowed) ──
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
    stack: cascade([]),
    docs: notated()
  },
  agents: [reviewer],
  prompt: "ops-lead/prompt"
})

// what the model will see for the notated tool: description from the store
const notatedBinding = bind(notated(), notes)
console.log("notated description:", String(notatedBinding[0]?.description))

// ── 2. the injection: notation + provider + connections → executable agent ──
const model = scriptedProvider([
  { text: "", toolCalls: [{ id: "1", name: "grafana__list_dashboards", input: {} }] },
  { text: "", toolCalls: [{ id: "2", name: "docs__search_notes", input: { q: "latency" } }] },
  { text: "", toolCalls: [{ id: "3", name: "stack__github__create_issue", input: { title: "latency spike" } }] },
  { text: "", toolCalls: [{ id: "4", name: "reviewer__invokeMessage", input: { message: "review the incident" } }] },
  { text: "reviewed.", toolCalls: [] },
  { text: "incident filed and reviewed.", toolCalls: [] }
])

const program = Effect.gen(function* () {
  const lead = yield* inject(opsLead, {
    notation,
    model,
    connections: [dashboards, monitoring, github, stack, notes],
    vars: { team: "platform-infra" }
  })

  const reply = yield* lead.invokeMessage("latency is spiking on prod")
  console.log("reply:", reply)

  const turns = yield* lead.listTurns
  console.log("turns:", turns.length, "status:", turns[0]?.status)

  const messages = yield* lead.listMessages
  for (const message of messages) console.log(" ", message.role, message.role === "tool" ? `${message.name}: ${message.content}` : message.content)

  // real-time rebind: the pool can change between invocations
  yield* lead.applyTools([dashboards, github, stack, notes])
  const rebound = yield* lead.invokeMessage("and now?")
  console.log("after rebind:", rebound)
})

await Effect.runPromise(program)
