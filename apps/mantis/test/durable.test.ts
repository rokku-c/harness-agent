/** The durable shared workspace (product R4): one append-only JSONL store
 * owned by the host; every conversation (agent sessions + the human UI) shares
 * it, and restarts reload it. Nothing here is per-resource - the store is
 * kind-agnostic over the workspace resource declarations. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { makeMantis } from "../src/agent.ts"
import { NotesStore } from "../src/tools.ts"
import { WebConsole, WORKSPACE_CONVERSATION } from "../src/hosts/webui/console.ts"
import { ConversationStore } from "../src/hosts/dingtalk/conversation.ts"
import { makeMantisMcp } from "../src/hosts/mcp/mcp.ts"
import { serveConsole } from "../src/hosts/webui/server.ts"
import type { Model } from "@effect-agent/builtin"
import { Effect } from "effect"
import { noopLogger } from "@effect-agent/logger"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"

const model: Model = { generate: () => Effect.succeed({ text: "{}", toolCalls: [] }) } as unknown as Model
const fslibSyncAppend = (file: string, line: string): void => {
  // append raw bytes without a trailing newline to simulate corruption safely
  const fd = require("node:fs").openSync(file, "a")
  require("node:fs").writeSync(fd, line)
  require("node:fs").closeSync(fd)
}
const tempDir = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix))

describe("durable workspace store", () => {
  test("records persist to the file and reload on a fresh store (id sequence continues)", () => {
    const dir = tempDir("mantis-durable-")
    const file = join(dir, "workspace.jsonl")
    const first = new NotesStore({ file })
    first.add("note", "survives restart")               // default source: agent
    first.add("task", "durable task", "ui")             // operator-written
    expect(existsSync(file)).toBe(true)
    const second = new NotesStore({ file })
    expect(second.all().map((e) => e.text)).toEqual(["survives restart", "durable task"])
    expect(second.all().find((e) => e.text === "survives restart")?.source).toBe("agent")
    expect(second.all().find((e) => e.text === "durable task")?.source).toBe("ui")
    const next = second.add("reminder", "after reload")
    expect(next.id).toBe("e3")
    expect(second.search("durable")).toHaveLength(1)
    rmSync(dir, { recursive: true, force: true })
  })

  test("corrupted log lines are skipped without losing the rest", () => {
    const dir = tempDir("mantis-durable-")
    const file = join(dir, "workspace.jsonl")
    const store = new NotesStore({ file })
    store.add("note", "good one")
    fslibSyncAppend(file, "{not-json}\n")
    const reloaded = new NotesStore({ file })
    expect(reloaded.all().map((e) => e.text)).toEqual(["good one"])
    rmSync(dir, { recursive: true, force: true })
  })

  test("makeMantis uses the injected shared store instead of a fresh one", () => {
    const shared = new NotesStore()
    const a = makeMantis({ model, notes: shared })
    const b = makeMantis({ model, notes: shared })
    expect(a.notes).toBe(shared)
    expect(b.notes).toBe(shared)
    a.notes.add("task", "visible everywhere")
    expect(b.notes.search("visible everywhere")).toHaveLength(1)
  })
})

describe("host shares ONE durable workspace across conversations + the human UI", () => {
  let web: WebConsole
  let server: { url: string; stop: () => void }
  let dir: string
  let file: string
  beforeAll(async () => {
    dir = tempDir("mantis-shared-")
    file = join(dir, "workspace.jsonl")
    web = new WebConsole({ model, uiDir: dir, workspaceFile: file, logger: noopLogger() })
    const mcpServer = makeMantisMcp({ console: web })
    const client = new Client({ name: "shared-test", version: "0.0.0" })
    const pair = InMemoryTransport.createLinkedPair()
    await mcpServer.connect(pair[0])
    await client.connect(pair[1])
    server = serveConsole({ client, publicDir: join(import.meta.dir, "../src/hosts/webui/public"), port: 0 })
  })
  afterAll(() => {
    server.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  test("any two conversations see the same store; human UI writes land in it", async () => {
    // every session host-session shares the injected durable store instance
    const s1 = web.host.session("conversation-one")
    const s2 = web.host.session(WORKSPACE_CONVERSATION)
    expect(s1.notes).toBe(s2.notes)
    // human UI path writes through the SAME instance
    const added = (await fetch(server.url + "/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "note", text: "shared human note" })
    }).then((r) => r.json())) as { ok: boolean }
    expect(added.ok).toBe(true)
    expect(s1.notes.search("shared human note")).toHaveLength(1)
    // and it is on disk: a brand-new console on the same file reloads it
    const rebooted = new WebConsole({ model, uiDir: dir, workspaceFile: file, logger: noopLogger() })
    expect(rebooted.host.session("any").notes.search("shared human note")).toHaveLength(1)
  })
})
describe("durable conversation memory", () => {
  test("turns persist to the memory file and reload on a fresh store", () => {
    const dir = tempDir("mantis-memory-")
    const first = new ConversationStore({ dir })
    first.add("conv-a", "user", "hello there")
    first.add("conv-a", "assistant", "hi back")
    first.add("conv-b", "user", "other thread")
    expect(existsSync(join(dir, "conversations.jsonl"))).toBe(true)
    const second = new ConversationStore({ dir })
    expect(second.history("conv-a").map((t) => t.role + ":" + t.text)).toEqual(["user:hello there", "assistant:hi back"])
    expect(second.history("conv-b")).toHaveLength(1)
    expect(second.conversationIds()).toEqual(["conv-a", "conv-b"])
    rmSync(dir, { recursive: true, force: true })
  })

  test("a rebooted console restores conversation memory: history binding + list + timeline", async () => {
    const memDir = tempDir("mantis-mem-")
    const stub: Model = {
      generate: () =>
        Effect.succeed({
          text: JSON.stringify({ reply: "understood", tone: "plain", asksConfirmation: false }),
          toolCalls: []
        })
    } as unknown as Model
    const first = new WebConsole({ model: stub, uiDir: memDir, memoryDir: memDir, logger: noopLogger() })
    const chat = await first.chatSync("mem-1", "remember: gate code 4711")
    expect(chat.ok).toBe(true)
    const second = new WebConsole({ model: stub, uiDir: memDir, memoryDir: memDir, logger: noopLogger() })
    // list shows the restored conversation (no live timeline on the new console)
    expect(second.conversations().some((c) => c.conversationId === "mem-1")).toBe(true)
    // timeline rebuilds from durable memory
    const timeline = second.conversationTimeline("mem-1")
    expect(timeline.filter((e) => e.kind === "msg")).toHaveLength(2)
    const texts = timeline.map((e) => (e.kind === "msg" ? e.text : "")).join(" ")
    expect(texts).toContain("4711")
    // the host session's history binding renders those turns for the agent
    expect(second.host.conversations.history("mem-1")[0]!.text).toBe("remember: gate code 4711")
    rmSync(memDir, { recursive: true, force: true })
  })
})

describe("restored enabled tool surface across restarts", () => {
  test("ConversationStore meta survives a reload", () => {
    const dir = tempDir("mantis-meta-")
    const first = new ConversationStore({ dir })
    first.recordEnabled("c-x", "note_read")
    first.recordEnabled("c-x", "task_write")
    first.recordEnabled("c-x", "note_read") // dedup
    const second = new ConversationStore({ dir })
    expect(second.enabled("c-x")).toEqual(["note_read", "task_write"])
    expect(second.enabled("c-other")).toEqual([])
    rmSync(dir, { recursive: true, force: true })
  })

  test("a rebooted host re-enables the conversation's extended tools before any turn", async () => {
    const memDir = tempDir("mantis-enable-")
    const enabling: Model = {
      generate: () =>
        Effect.succeed({
          text: JSON.stringify({ reply: "will enable", tone: "plain", asksConfirmation: false }),
          toolCalls: [{ id: "e1", name: "enable", input: { name: "note_read" } }]
        })
    } as unknown as Model
    const final: Model = {
      generate: () =>
        Effect.succeed({
          text: JSON.stringify({ reply: "done", tone: "plain", asksConfirmation: false }),
          toolCalls: []
        })
    } as unknown as Model
    const first = new WebConsole({ model: enabling, uiDir: memDir, memoryDir: memDir, logger: noopLogger() })
    await first.chatSync("en1", "please enable note_read")
    expect(first.host.conversations.enabled("en1")).toContain("note_read")
    const second = new WebConsole({ model: final, uiDir: memDir, memoryDir: memDir, logger: noopLogger() })
    const session = second.host.session("en1")
    expect(session.supply.visible()).toContain("note_read")
    expect(session.supply.catalog().some((c) => c.name === "note_read")).toBe(true)
    rmSync(memDir, { recursive: true, force: true })
  })
})
