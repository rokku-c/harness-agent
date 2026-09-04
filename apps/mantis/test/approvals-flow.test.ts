/**
 * Approval loop under a SCRIPTED model (no network/key): the agent first
 * discovers (tools_catalog) and enables (enable note_write), then the
 * protected write suspends the turn; the operator sees it in pendingApprovals
 * and approve/deny drives the outcome - asserted end-to-end on the console's
 * own gate + durable shared workspace. This pins the R24 gated-demo behaviour.
 */
import { describe, expect, test } from "bun:test"
import type { Model } from "@effect-agent/builtin"
import { makeLogger } from "@effect-agent/logger"
import { Effect } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { WebConsole } from "../src/hosts/webui/console.ts"

const silentLogger = makeLogger({ level: "warn", write: () => {} }, "approvals-flow-test")
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const until = async (probe: () => boolean, budgetMs: number): Promise<boolean> => {
  const start = Date.now()
  while (Date.now() - start < budgetMs) {
    if (probe()) return true
    await sleep(20)
  }
  return false
}

/** stages: catalog -> enable note_write -> note_write -> final_answer echo */
const fullAgentFlow = (noteText: string): Model => {
  let calls = 0
  const model: any = {
    generate: (_s: string, messages: ReadonlyArray<unknown>) =>
      Effect.gen(function* () {
        calls += 1
        const tool = (name: string, input: unknown) => ({ text: "", toolCalls: [{ id: "t" + calls, name, input }] })
        if (calls === 1) return tool("tools_catalog", {})
        if (calls === 2) return tool("enable", { name: "note_write" })
        if (calls === 3) return tool("note_write", { text: noteText })
        const last = [...messages].reverse().find((m: any) => m.role === "user") as { content?: string } | undefined
        const text = String(last?.content ?? "").replace(/^Text: /, "").split("\n")[0] ?? ""
        return tool("final_answer", { reply: "done:" + text, tone: "plain", asksConfirmation: false })
      })
  }
  return model
}
const makeConsole = (model: Model): { c: WebConsole; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), "mantis-approval-"))
  const c = new WebConsole({
    model,
    uiDir: join(dir, "ui"),
    workspaceFile: join(dir, "ws.jsonl"),
    memoryDir: join(dir, "mem"),
    logger: silentLogger,
    protectedTools: ["note_write"]
  })
  return { c, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

describe("console approval loop (scripted model)", () => {
  test("approve lets the protected write land and the turn finishes", async () => {
    const { c, cleanup } = makeConsole(fullAgentFlow("AUTOTEST-APPROVE marker"))
    try {
      const fired = await c.chatFire("c1", "save this note please")
      expect(fired.ok).toBe(true)
      const seen = await until(() => c.pendingApprovals().some((p) => p.input.tool === "note_write"), 4000)
      expect(seen).toBe(true)
      const pending = c.pendingApprovals().find((p) => p.input.tool === "note_write")!
      expect(pending.input.session).toBe("c1")
      expect(pending.input.input).toMatchObject({ text: "AUTOTEST-APPROVE marker" })
      const ok = await c.resolveApproval(pending.callId, true)
      expect(ok.ok).toBe(true)
      const landed = await until(() => c.workspace.records("note").length > 0, 4000)
      expect(landed).toBe(true)
      const record = c.workspace.records("note")[0]
      expect(record?.text).toContain("AUTOTEST-APPROVE")
      expect(record?.source).toBe("agent")
      const replied = await until(() => {
        const tl = c.conversationTimeline("c1")
        return tl.some((e) => e.kind === "msg" && e.role === "assistant")
      }, 5000)
      expect(replied).toBe(true)
      expect(c.pendingApprovals().length).toBe(0)
    } finally { cleanup() }
  })

  test("deny drops the write, tells the model, and still closes the turn", async () => {
    const { c, cleanup } = makeConsole(fullAgentFlow("AUTOTEST-DENY marker"))
    try {
      await c.chatFire("c2", "please save this too")
      const seen = await until(() => c.pendingApprovals().some((p) => p.input.tool === "note_write"), 4000)
      expect(seen).toBe(true)
      const pending = c.pendingApprovals().find((p) => p.input.tool === "note_write")!
      const ok = await c.resolveApproval(pending.callId, false)
      expect(ok.ok).toBe(true)
      const closed = await until(() => c.pendingApprovals().length === 0, 4000)
      expect(closed).toBe(true)
      const replied = await until(() => {
        const tl = c.conversationTimeline("c2")
        return tl.some((e) => e.kind === "msg" && e.role === "assistant")
      }, 5000)
      expect(replied).toBe(true)
      expect(c.workspace.records("note").some((r) => r.text.includes("AUTOTEST-DENY"))).toBe(false)
    } finally { cleanup() }
  })
})
