/**
 * Console flow under a SCRIPTED model (no network/key): the reconstructed
 * WebConsole (R23 ALS attribution + R24 in-flight guard + R25 tail rebuild)
 * must answer, attribute interleaved conversations, and reject a same-
 * conversation double-send - all asserted without a live model.
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { Model } from "@effect-agent/builtin"
import { makeLogger } from "@effect-agent/logger"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { WebConsole } from "../src/hosts/webui/console.ts"

const silentLogger = makeLogger({ level: "warn", write: () => {} }, "console-flow-test")
const replyFor = (text: string): string => "echo:" + text.slice(0, 40)
/** a model that answers every user turn with a native final_answer call */
const scripted = (holdMs = 0): Model => {
  const model: any = {
    generate: (_s: string, messages: ReadonlyArray<unknown>) =>
      Effect.gen(function* () {
        if (holdMs > 0) yield* Effect.sleep(holdMs)
        const last = [...messages].reverse().find((m: any) => m.role === "user") as { content?: string } | undefined
        const text = String(last?.content ?? "").replace(/^Text: /, "").split("\n")[0] ?? ""
        return {
          text: "",
          toolCalls: [{ id: "f" + Math.random().toString(36).slice(2, 7), name: "final_answer", input: { reply: replyFor(text), tone: "plain", asksConfirmation: false } }]
        }
      })
  }
  return model
}
const withDirs = (dir: string, fn: (c: WebConsole) => Promise<void>, model: Model = scripted()): Promise<void> =>
  fn(new WebConsole({ model, uiDir: join(dir, "ui"), workspaceFile: join(dir, "ws.jsonl"), memoryDir: join(dir, "mem"), logger: silentLogger }))
/** final-answers with how many times it has seen a marker string in the thread */
const countingModel = (marker: string): Model => {
  const model: any = {
    generate: (_s: string, messages: ReadonlyArray<unknown>) =>
      Effect.gen(function* () {
        const all = messages.map((m: any) => String(m.content ?? "")).join("\n")
        const count = all.split(marker).length - 1
        return {
          text: "",
          toolCalls: [{ id: "c", name: "final_answer", input: { reply: "saw:" + count, tone: "plain", asksConfirmation: false } }]
        }
      })
  }
  return model
}
const withConsole = async (model: Model, fn: (c: WebConsole) => Promise<void>) => {
  const dir = mkdtempSync(join(tmpdir(), "mantis-console-"))
  const c = new WebConsole({ model, uiDir: join(dir, "ui"), workspaceFile: join(dir, "ws.jsonl"), memoryDir: join(dir, "mem"), logger: silentLogger })
  try { await fn(c) } finally { rmSync(dir, { recursive: true, force: true }) }
}

describe("web console flow (scripted model)", () => {
  test("chatSync returns the final reply and stores the conversation", async () => {
    await withConsole(scripted(), async (c) => {
      const r = await c.chatSync("t1", "hello mantis")
      expect(r.ok).toBe(true)
      expect(r.reply).toBe("echo:hello mantis")
      const list = c.conversations()
      expect(list.some((x) => x.conversationId === "t1" && x.turns >= 2)).toBe(true)
    })
  })
  test("two interleaved conversations keep their own replies (ALS attribution)", async () => {
    await withConsole(scripted(60), async (c) => {
      const [a, b] = await Promise.all([c.chatSync("a", "line A"), c.chatSync("b", "line B")])
      expect(a.ok && b.ok).toBe(true)
      expect(a.reply).toBe("echo:line A")
      expect(b.reply).toBe("echo:line B")
    })
  })
  test("a fresh console over the same dirs remembers turns + workspace (restart trust)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-restart-"))
    try {
      await withDirs(dir, async (c) => {
        const r = await c.chatSync("rp", "remember me")
        expect(r.ok && r.reply).toBe("echo:remember me")
        c.workspace.append("note", "AUTOTEST-PERSIST marker")
      })
      await withDirs(dir, async (c2) => {
        // the counting model sees the FIRST message again only if durable
        // conversation memory survived the restart: reply must be saw:2
        const r2 = await c2.chatSync("rp", "again")
        expect(r2.ok && r2.reply).toBe("saw:2")
        expect(c2.workspace.records("note").some((x) => x.text.includes("AUTOTEST-PERSIST"))).toBe(true)
      }, countingModel("remember me"))
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
  test("workspace records can be edited and removed through the operator surface", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-ws-ops-"))
    try {
      await withDirs(dir, async (c) => {
        const added = c.workspace.append("note", "edit me")
        expect(added.id.length > 0).toBe(true)
        const updated = c.workspace.update(added.id, "edited text")
        expect(updated?.text).toBe("edited text")
        expect(c.workspace.records("note").some((x) => x.id === added.id && x.text === "edited text")).toBe(true)
        expect(c.workspace.remove(added.id)).toBe(true)
        expect(c.workspace.records("note").some((x) => x.id === added.id)).toBe(false)
        expect(c.workspace.remove("no-such-id")).toBe(false)
      })
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
  test("ui version snapshot contract: empty until pushed, restore of unknown fails soft", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-ui-contract-"))
    try {
      await withDirs(dir, async (c) => {
        expect(c.ui.latest()).toBeUndefined()
        expect(c.ui.versions().length).toBe(0)
        const r = c.restoreUi(1)
        expect(r.ok).toBe(false)
      })
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })
  test("a second message to the SAME conversation is rejected as busy", async () => {
    await withConsole(scripted(80), async (c) => {
      const first = c.chatSync("s", "first")
      const second = await c.chatSync("s", "second")
      expect(second.ok).toBe(false)
      expect(second.detail ?? "").toContain("busy")
      const firstResult = await first
      expect(firstResult.ok).toBe(true)
    })
  })
})
