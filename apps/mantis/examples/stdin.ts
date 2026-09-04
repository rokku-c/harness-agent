/**
 * mantis session - a runnable assembly with ONE protected tool (note_write).
 *
 * The agent runs offline on a scripted model (set OPENAI_API_KEY + OPENAI_MODEL
 * for a real model). When the agent calls a protected tool it WAITS on the
 * operator console; the operator answers on stdin - the same seam a real host
 * (e.g. the dingtalk host) drives from an owner's reply. No auto-approval,
 * no polling: approval is a person.
 *
 * Run: bun apps/mantis/src/main.ts
 */
import { Effect } from "effect"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { openaiModel } from "@effect-agent/model"
import { ManualGate } from "@effect-agent/gate"
import type { Model } from "@effect-agent/builtin"
import { makeMantis } from "../src/agent.ts"
import { gateApproval } from "../src/approval.ts"

const final = (reply: string) => ({
  text: JSON.stringify({ reply, tone: "plain", asksConfirmation: false }),
  toolCalls: [] as Array<never>
})

const scripted = (): Model => {
  const queue = [
    { text: "", toolCalls: [{ id: "t1", name: "enable", input: { name: "note_write" } }] },
    { text: "", toolCalls: [{ id: "t2", name: "note_write", input: { text: "ship v2 after review" } }] },
    { text: "", toolCalls: [{ id: "t3", name: "recall_notes", input: { query: "ship v2" } }] },
    final("Noted for v2 - let me check what's recorded.")
  ]
  return {
    id: "scripted",
    capabilities: { streaming: false, thinking: false, multimodal: false, usage: false },
    generate: () => Effect.succeed(queue.shift() ?? final("done"))
  } as Model
}

const model = process.env.OPENAI_API_KEY
  ? openaiModel({
      api: "openai.chat",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL
    })
  : scripted()

// the operator console: only note_write is protected
const gate = new ManualGate()
const mantis = makeMantis({
  model,
  approvals: gateApproval(gate, (request) => request.tool === "note_write")
})

const answers = createInterface({ input: stdin, output: stdout })
// the operator console: driven by the gate's onPending event (no polling)
gate.onPending(async (pending) => {
  const input = JSON.stringify(pending.input.input)
  const answer = await answers.question(
    "[operator] " + pending.input.tool + " " + input + " - approve? (y/n) "
  )
  await Effect.runPromise(gate.resolve(pending.callId, answer.trim().toLowerCase() === "y"))
})

const out = await Effect.runPromise(
  mantis.agent.run("v2 ships tomorrow - note the release confirmation, then check what is recorded")
)
console.log("\nfinal reply:", out.reply, "| tone:", out.tone, "| asksConfirmation:", out.asksConfirmation)
console.log("workspace:", mantis.notes.all().map((entry) => "[" + entry.kind + "] " + entry.text).join("; "))
process.exit(0)
