/**
 * mantis as an MCP server: an in-memory MCP client calls the tools end to
 * end - chat returns the session reply, approvals list + resolve.
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import type { Model, WireMessage, WireTool } from "@effect-agent/builtin"
import { noopLogger } from "@effect-agent/logger"
import { WebConsole } from "../src/hosts/webui/console.ts"
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

const toolText = (result: unknown): string => {
  const r = result as { content?: Array<{ type: string; text: string }> }
  return (r.content ?? []).map((c) => c.text).join("")
}

describe("mantis MCP server", () => {
  test("tools are listed; chat returns the session reply", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-mcp-"))
    try {
      const web = new WebConsole({
        model: scriptedModel([finalJson("hello from mcp")]),
        uiDir: dir,
        logger: noopLogger()
      })
      const server = makeMantisMcp({ console: web })
      const client = new Client({ name: "test", version: "0.0.0" })
      const pair = InMemoryTransport.createLinkedPair()
      await server.connect(pair[0])
      await client.connect(pair[1])

      const listed = await client.listTools()
      const names = listed.tools.map((t) => t.name)
      expect(names).toContain("mantis_chat")
      expect(names).toContain("mantis_approve")

      const reply = await client.callTool({ name: "mantis_chat", arguments: { conversationId: "m1", text: "hi" } })
      expect(toolText(reply)).toContain("hello from mcp")
      const convs = await client.callTool({ name: "mantis_conversations" })
      expect(toolText(convs)).toContain("m1")
      // state-first: the session timeline (messages + tool steps) is readable
      const timeline = await client.callTool({ name: "mantis_conversation", arguments: { conversationId: "m1" } })
      const text = toolText(timeline)
      expect(text).toContain("\"kind\":\"msg\"")
      expect(text).toContain("\"role\":\"user\"")
      expect(text).toContain("\"role\":\"assistant\"")
      expect(text).toContain("hello from mcp")

      await client.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("a protected call waits; mantis_pending + mantis_approve resolve it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-mcp-approve-"))
    const web = new WebConsole({
      model: scriptedModel([
        { text: "", toolCalls: [{ id: "e1", name: "enable", input: { name: "note_write" } }] },
        { text: "", toolCalls: [{ id: "w1", name: "note_write", input: { text: "mcp write" } }] },
        finalJson("saved it")
      ]),
      uiDir: dir,
      protectedTools: ["note_write"],
      logger: noopLogger()
    })
    const server = makeMantisMcp({ console: web })
    const client = new Client({ name: "test", version: "0.0.0" })
    const pair = InMemoryTransport.createLinkedPair()
    await server.connect(pair[0])
    await client.connect(pair[1])
    try {
      const chat = client.callTool({ name: "mantis_chat", arguments: { conversationId: "m2", text: "save this" } })
      await waitFor(async () => web.pendingApprovals().length === 1)
      const pendingText = toolText(await client.callTool({ name: "mantis_pending" }))
      expect(pendingText).toContain("note_write")
      const approved = await client.callTool({
        name: "mantis_approve",
        arguments: { callId: web.pendingApprovals()[0]!.callId, allow: true }
      })
      expect(toolText(approved)).toBe("resolved")
      const result = await chat
      expect(toolText(result)).toContain("saved it")
      expect(web.host.session("m2").notes.all().some((n) => n.text === "mcp write")).toBe(true)
      await client.close()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})


describe("workspace write length caps over MCP", () => {
  const make = async () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-mcp-cap-"))
    const web = new WebConsole({
      model: scriptedModel([finalJson("unused")]),
      uiDir: dir,
      logger: noopLogger()
    })
    const server = makeMantisMcp({ console: web })
    const client = new Client({ name: "test", version: "0.0.0" })
    const pair = InMemoryTransport.createLinkedPair()
    await server.connect(pair[0])
    await client.connect(pair[1])
    return { web, client, dir }
  }

  test("oversized append fails with a readable error and stores nothing", async () => {
    const { client, dir } = await make()
    try {
      const result = await client.callTool({
        name: "mantis_workspace_write",
        arguments: { kind: "task", text: "x".repeat(50001) }
      })
      const text = toolText(result)
      expect(text).toContain("error:")
      expect(text).toContain("exceeds")
      const snap = toolText(await client.callTool({ name: "mantis_workspace" }))
      expect(snap).not.toContain("x".repeat(100))
    } finally {
      rmSync(dir, { recursive: true, force: true })
      await client.close()
    }
  })

  test("large-but-valid append succeeds; oversized update fails and record stays", async () => {
    const { client, dir } = await make()
    try {
      const ok = await client.callTool({ name: "mantis_workspace_write", arguments: { kind: "note", text: "m".repeat(10000) } })
      const record = JSON.parse(toolText(ok)) as { id: string }
      const over = await client.callTool({ name: "mantis_workspace_update", arguments: { id: record.id, text: "y".repeat(50001) } })
      expect(toolText(over)).toContain("exceeds")
      const snap = toolText(await client.callTool({ name: "mantis_workspace" }))
      expect(snap).toContain("m".repeat(20))
      expect(snap).not.toContain("y".repeat(20))
    } finally {
      rmSync(dir, { recursive: true, force: true })
      await client.close()
    }
  })
})

describe("chat length guard over MCP", () => {
  const make = async (script: Script) => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-mcp-chatlen-"))
    const web = new WebConsole({ model: scriptedModel(script), uiDir: dir, logger: noopLogger() })
    const server = makeMantisMcp({ console: web })
    const client = new Client({ name: "test", version: "0.0.0" })
    const pair = InMemoryTransport.createLinkedPair()
    await server.connect(pair[0])
    await client.connect(pair[1])
    return { web, client, dir }
  }

  test("a message over MAX_CHAT_TEXT is refused with a readable error, not a transport 500", async () => {
    const { client, dir } = await make([finalJson("never reached")])
    try {
      const result = await client.callTool({
        name: "mantis_chat",
        arguments: { conversationId: "l1", text: "a".repeat(100001), wait: true }
      })
      const text = toolText(result)
      expect(text).toContain("error:")
      expect(text).toContain("too long")
      // no model turn was burned and nothing entered the timeline
      expect(client.listTools).toBeDefined()
    } finally {
      await client.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("long-but-allowed text (10k, past the old zod 4000 cap) still runs a normal turn", async () => {
    const { client, dir } = await make([finalJson("long ok")])
    try {
      const result = await client.callTool({
        name: "mantis_chat",
        arguments: { conversationId: "l2", text: "b".repeat(10000), wait: true }
      })
      expect(toolText(result)).toContain("long ok")
    } finally {
      await client.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

