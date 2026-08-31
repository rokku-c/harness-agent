/**
 * Live: Claude Code as a ComposedAgent - a black box with its own loop and
 * runtime, expressed as just another Driver. Binding ops become native MCP
 * tools inside Claude Code's process. Requires the Claude Code CLI auth.
 * Run: bun run examples 04 --live
 */
import { Effect, Schema } from "effect"
import { Agent, AgentContext, Until, notationText, Op, type Binding } from "@effect-agent/core"
import { ClaudeCode } from "@effect-agent/builtin"

const Notes: Binding = {
  uri: "ea://svc/notes/main",
  ops: [Op.read({
    name: "search_notes",
    description: notationText("Search past incident notes for history and postmortems."),
    input: Schema.Struct({ q: Schema.String }),
    output: Schema.Struct({ hits: Schema.Array(Schema.String) }),
    execute: ({ q }) => Effect.succeed({ hits: ["2026-08-12 postmortem: " + q + " was caused by a config rollback"] })
  })]
}

const Analyst = Agent
  .define("incident-analyst", (incident: string) => AgentContext.text("Investigate briefly: " + incident))
  .returns(Until.text)
  .uses(Notes)
  .implementedBy(ClaudeCode.make({ maxTurns: 6, permissionMode: "default" }))

const analysis = await Effect.runPromise(Analyst.run("latency spike on prod"))
console.log("analysis:", analysis)

