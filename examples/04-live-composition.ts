/**
 * LIVE composition: the full architecture story against the real provider.
 *
 * Two architectures (ops-lead composes reviewer) + four connection modes
 * (named / cascade / notated / any-slot idle) + {var} interpolation - all
 * model-facing prose resolved from notation stores, the real model driving
 * the tool loop end to end.
 *
 * Run: bun run example:04
 */
import { Effect } from "effect"
import {
  anthropicProvider, architect, bind, cascade, connection, inject, named,
  notated, memoryNotationStore, notatedTool, type Connection, type NotationStore
} from "@effect-agent/core"

const apiKey = process.env.LLM_API_KEY
if (apiKey === undefined) {
  console.log("set LLM_API_KEY (see .env) to run this example against the live provider")
  process.exit(0)
}

// ── connections: every model-facing description comes from a notation store ──
const grafanaStore = (): NotationStore => memoryNotationStore([
  { target: "tool:list_dashboards", instructions: ["List the monitoring dashboards available for the fleet."] }
])
const dashboards = connection("grafana", [
  notatedTool({
    name: "list_dashboards",
    input: { type: "object", properties: {} },
    output: { type: "object" },
    execute: () => Effect.succeed({ dashboards: ["latency", "errors", "saturation"] })
  }, grafanaStore())
])

const notes = connection("docs", [
  notatedTool({
    name: "search_notes",
    input: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
    output: { type: "object" },
    execute: (input: unknown) => {
      const { q } = input as { q: string }
      return Effect.succeed({ hits: [`2026-08-12 postmortem: ${q} incident, root cause was a config rollback`] })
    }
  }, memoryNotationStore([
    { target: "tool:search_notes", instructions: ["Search past incident notes for history and postmortems."] }
  ]))
], memoryNotationStore([
  { target: "tool:search_notes", instructions: ["Search past incident notes for history and postmortems."] }
]))

const github = connection("github", [
  notatedTool({
    name: "create_issue",
    input: { type: "object", properties: { title: { type: "string" }, body: { type: "string" } }, required: ["title"] },
    output: { type: "object" },
    execute: (input: unknown) => {
      const { title } = input as { title: string }
      return Effect.succeed({ issue: 17, title })
    }
  }, memoryNotationStore([
    { target: "tool:create_issue", instructions: ["File ONE issue per incident; link the dashboard name in the body."] }
  ]))
])

const stack = connection("stack", []) as Connection & { members?: ReadonlyArray<Connection> }
stack.members = [dashboards, github]

// ── the notation: prompts (and the {team} interpolation variable) ──
const notation = memoryNotationStore([
  { target: "reviewer/prompt", instructions: ["You review incidents calmly and cite evidence from the notes."] },
  { target: "ops-lead/prompt", instructions: [
    "You are the operations lead for the {team} team.",
    "When an incident is reported: check the dashboards, search the notes for history,",
    "file an issue on the stack, and ask the reviewer to weigh in. Then summarize."
  ] }
])

// ── the architectures: pure-data blueprints ──
const reviewer = architect({ name: "reviewer", connections: {}, prompt: "reviewer/prompt" })
const opsLead = architect({
  name: "ops-lead",
  connections: { dashboards: named("grafana"), docs: notated(), stack: cascade([]) },
  agents: [reviewer],
  prompt: "ops-lead/prompt"
})

const model = anthropicProvider({
  apiKey,
  model: process.env.LLM_MODEL ?? "deepseek-v4-flash",
  baseUrl: process.env.LLM_BASE_URL ?? "https://ai-api-gateway.app.baizhiyun.vip/api/anthropic"
})

const program = Effect.gen(function* () {
  const lead = yield* inject(opsLead, {
    notation,
    model,
    connections: [dashboards, github, stack, notes],
    vars: { team: "platform-infra" }
  })
  // what the notated slot bound (description resolved from the store)
  const bound = bind(notated(), notes)
  console.log("bound notated tool:", bound.map((tool) => `${tool.boundName}: ${String(tool.description)}`)[0])

  const reply = yield* lead.invokeMessage("latency is spiking on prod - handle it end to end")
  console.log("reply:", reply)
  const messages = yield* lead.listMessages
  for (const message of messages)
    console.log(" ", message.role, message.role === "tool" ? `${message.name}: ${message.content.slice(0, 120)}` : message.content.slice(0, 160))
})

await Effect.runPromise(program).catch((cause) => {
  console.error("live run failed:", cause)
  process.exit(1)
})
