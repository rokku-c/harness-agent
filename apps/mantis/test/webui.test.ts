/**
 * The web console: versioned agent UI store, the console wiring (messages ->
 * MantisHost -> bus/reply, approvals resolved by the page = operator), and
 * the HTTP surface (static panel + JSON API).
 */
import { mkdtempSync, rmSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Model, WireMessage, WireTool } from "@effect-agent/builtin"
import { makeLogger, noopLogger } from "@effect-agent/logger"
import { WebConsole } from "../src/hosts/webui/console.ts"
import { serveConsole } from "../src/hosts/webui/server.ts"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { makeMantisMcp } from "../src/hosts/mcp/mcp.ts"

type Script = Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }>
const scriptedModel = (script: Script): Model => {
  const queue = [...script]
  const model: any = {
    generate: (_s: string, _messages: ReadonlyArray<WireMessage>, _tools: ReadonlyArray<WireTool>) =>
      Effect.succeed(queue.shift() ?? { text: JSON.stringify({ reply: "done", tone: "plain", asksConfirmation: false }), toolCalls: [] })
  }
  return model
}
const finalJson = (reply: string) => ({
  text: JSON.stringify({ reply, tone: "plain", asksConfirmation: false }),
  toolCalls: [] as Array<never>
})
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const waitFor = async (condition: () => Promise<boolean> | boolean, timeoutMs = 4_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await condition()) return
    await sleep(10)
  }
  throw new Error("waitFor timed out")
}
const tempDir = (prefix: string): string => mkdtempSync(join(tmpdir(), prefix))



describe("WebConsole wiring", () => {
  test("a message turns into a session reply on the bus + history", async () => {
    const web = new WebConsole({
      model: scriptedModel([finalJson("hello from mantis")]),
      logger: noopLogger()
    })
    await web.handleMessage("t1", "hi")
    await waitFor(async () => web.host.conversations.history("t1").length === 2)
    const turns = web.host.conversations.history("t1")
    expect(turns[0]).toMatchObject({ role: "user", text: "hi" })
    expect(turns[1]).toMatchObject({ role: "assistant", text: "hello from mantis" })
    expect(web.bus.history().some((e) => e.type === "reply" && e.conversationId === "t1")).toBe(true)
  })

  test("protected calls appear as pending approvals the console resolves", async () => {
    const web = new WebConsole({
      model: scriptedModel([
        { text: "", toolCalls: [{ id: "e1", name: "enable", input: { name: "note_write" } }] },
        { text: "", toolCalls: [{ id: "w1", name: "note_write", input: { text: "secret" } }] },
        finalJson("saved it")
      ]),
      protectedTools: ["note_write"],
      logger: noopLogger()
    })
    const turn = web.handleMessage("t2", "save this")
    await waitFor(async () => web.pendingApprovals().length === 1)
    const pending = web.pendingApprovals()[0]!
    expect(pending.input.tool).toBe("note_write")
    // the gate input carries the conversation that asked (operator context)
    expect(pending.input.session).toBe("t2")
    expect(web.state().pending[0]!.session).toBe("t2")
    const resolved = await web.resolveApproval(pending.callId, true)
    expect(resolved.ok).toBe(true)
    await turn
    expect(web.host.session("t2").notes.all().some((n) => n.text === "secret")).toBe(true)
  })

})

describe("HTTP surface (MCP-translated)", () => {
  let web: WebConsole
  let server: { url: string; stop: () => void }
  let dir: string
  beforeAll(async () => {
    dir = tempDir("mantis-http-ui-")
    web = new WebConsole({
      model: scriptedModel([finalJson("served")]),
      logger: noopLogger()
    })
    // the panel talks to the mantis MCP server through an in-process client
    const mcpServer = makeMantisMcp({ console: web })
    const client = new Client({ name: "test-console", version: "0.0.0" })
    const pair = InMemoryTransport.createLinkedPair()
    await mcpServer.connect(pair[0])
    await client.connect(pair[1])
    server = serveConsole({ client, publicDir: join(import.meta.dir, "../src/hosts/webui/public"), port: 0 })
  })
  afterAll(() => {
    server.stop()
    rmSync(dir, { recursive: true, force: true })
  })

  test("serves the panel + state + message round trip", async () => {
    const html = await fetch(server.url + "/").then((r) => r.text())
    expect(html).toContain("mantis console")
    const state = (await fetch(server.url + "/api/state").then((r) => r.json())) as Record<string, unknown>
    expect(state).toHaveProperty("conversations")
    const sent = (await fetch(server.url + "/api/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: "http-1", text: "hi" })
    }).then((r) => r.json())) as { accepted: boolean; detail?: string }
    expect(sent.accepted).toBe(true)
    await waitFor(async () =>
      ((await fetch(server.url + "/api/state").then((r) => r.json())) as { conversations: Array<{ conversationId: string }> }).conversations.some((c) => c.conversationId === "http-1")
    )
  })

  test("health liveness probe reports ok with startedAt + approvals", async () => {
    const health = (await fetch(server.url + "/api/health").then((r) => r.json())) as { ok: boolean; startedAt: number; approvalsOn: boolean }
    expect(health.ok).toBe(true)
    expect(typeof health.startedAt).toBe("number")
    expect(typeof health.approvalsOn).toBe("boolean")
  })

  test("conversation state round trips: events ring + per-conversation timeline", async () => {
    // STATE-FIRST: the reply is read back as snapshots, not a pushed stream.
    const sent = (await fetch(server.url + "/api/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: "conv-1", text: "hello state" })
    }).then((r) => r.json())) as { accepted: boolean }
    expect(sent.accepted).toBe(true)
    // the event ring (stateless ?after poll) surfaces the reply event
    await waitFor(async () => {
      const events = (await fetch(server.url + "/api/events?after=0").then((r) => r.json())) as { events: Array<{ type: string }> }
      return events.events.some((e) => e.type === "reply" && (e as { conversationId?: string }).conversationId === "conv-1")
    })
    expect((await fetch(server.url + "/api/events?after=0").then((r) => r.json())) as unknown).toBeDefined()
    // the per-conversation timeline already holds the full turn (no event juggling)
    const timeline = (await fetch(server.url + "/api/conversation?conversationId=conv-1").then((r) => r.json())) as {
      entries: Array<{ kind: string; role?: string; text?: string }>
    }
    expect(timeline.entries.some((e) => e.kind === "msg" && e.role === "user" && e.text === "hello state")).toBe(true)
    await waitFor(async () => {
      const tl = (await fetch(server.url + "/api/conversation?conversationId=conv-1").then((r) => r.json())) as {
        entries: Array<{ kind: string; role?: string; text?: string }>
      }
      // the assistant turn landed as timeline state (scripted model replies any text)
      return tl.entries.some((e) => e.kind === "msg" && e.role === "assistant")
    })
  })

  test("declarative workspace round trips over http (via MCP): write + read derived from the resource declarations", async () => {
    const addResult = (await fetch(server.url + "/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "task", text: "land R3 workspace UI" })
    }).then((r) => r.json())) as { ok: boolean; detail?: string; record?: { kind: string } }
    expect(addResult.ok).toBe(true)
    expect(addResult.record?.kind).toBe("task")
    const snap = (await fetch(server.url + "/api/workspace").then((r) => r.json())) as {
      resources: Array<{ kind: string; label: string; write: { name: string }; records: Array<{ text: string }> }>
    }
    const kinds = snap.resources.map((r) => r.kind)
    expect(kinds).toContain("task")
    expect(kinds).toContain("note")
    expect(kinds).toContain("reminder")
    const task = snap.resources.find((r) => r.kind === "task")
    expect(task?.label).toBe("task")
    expect(task?.write.name).toBe("task_write")
    expect(task?.records.some((r) => r.text === "land R3 workspace UI")).toBe(true)
    // unknown kinds are rejected by the declaration-driven MCP tool
    const rejected = (await fetch(server.url + "/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "unknown", text: "x" })
    }).then((r) => r.json())) as { ok: boolean; detail?: string }
    expect(rejected.ok).toBe(false)
  })

})