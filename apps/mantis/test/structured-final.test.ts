/**
 * Structured output over native tool calls (R24): until: Schema is served by
 * the protocol-level final_answer tool (input schema = required output).
 * - the model finishes by CALLING final_answer; its args decode straight to
 *   the typed result (no hand-rolled "JSON text + retry nag" loop)
 * - a malformed final_answer is a normal TOOL error: readable diagnostic is
 *   fed back and the model self-corrects through the existing channel
 * - a plain-text JSON reply still decodes silently (legacy fallback)
 */
import { describe, expect, test } from "bun:test"
import type { Model, WireMessage, WireTool } from "@effect-agent/builtin"
import { Effect } from "effect"
import { makeMantis, type Mantis } from "../src/agent.ts"
import { noopLogger } from "@effect-agent/logger"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { FinalReply } from "../src/final.ts"

type Script = Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }>
const scriptedModel = (script: Script): Model => {
  const queue = [...script]
  const model: any = {
    generate: (_s: string, _messages: ReadonlyArray<WireMessage>, _tools: ReadonlyArray<WireTool>) =>
      Effect.succeed(queue.shift() ?? { text: "", toolCalls: [] })
  }
  return model
}
const finalCall = (reply: string, extra: Record<string, unknown> = {}) => ({
  text: "",
  toolCalls: [{ id: "f" + Math.random().toString(36).slice(2, 7), name: "final_answer", input: { reply, tone: "plain", asksConfirmation: false, ...extra } }]
})
describe("final_answer native structured output", () => {
  test("a final_answer tool call yields the typed FinalReply", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-final-native-"))
    try {
      const m = makeMantis({ model: scriptedModel([finalCall("native ok")]) })
      const reply = await Effect.runPromise(m.agent.run("do it")) as FinalReply
      expect(reply.reply).toBe("native ok")
      expect(reply.tone).toBe("plain")
      expect(reply.asksConfirmation).toBe(false)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  test("a malformed final_answer feeds a readable tool error; the model's next call succeeds", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-final-retry-"))
    try {
      // first attempt: args missing required fields (reply/tone absent)
      const bad = { text: "", toolCalls: [{ id: "f0", name: "final_answer", input: { asksConfirmation: false } }] }
      const m = makeMantis({ model: scriptedModel([bad, finalCall("recovered")]) })
      const reply = await Effect.runPromise(m.agent.run("go")) as FinalReply
      expect(reply.reply).toBe("recovered")
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  test("plain-text JSON final replies still decode (legacy fallback)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-final-text-"))
    try {
      const m = makeMantis({
        model: scriptedModel([{ text: JSON.stringify({ reply: "legacy text", tone: "plain", asksConfirmation: false }), toolCalls: [] }])
      })
      const reply = await Effect.runPromise(m.agent.run("hi")) as FinalReply
      expect(reply.reply).toBe("legacy text")
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
