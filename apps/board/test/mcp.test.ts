/**
 * End-to-end through the MCP surface (layer ④): a real MCP client drives
 * board tools over an in-process transport - the exact path Claude Code and
 * the web panel use. board_coordinate lights up only when a model exists.
 */
import { describe, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { Effect } from "effect"
import { makeBoard } from "../src/board.ts"
import { makeBoardMcp } from "../src/hosts/mcp/board-mcp.ts"
import { scriptedModel } from "./helpers.ts"

const call = async (client: Client, name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> => {
  const result = (await client.callTool({ name, arguments: args })) as { content: ReadonlyArray<{ type: string; text: string }>; isError?: boolean }
  const first = result.content[0] ?? { type: "text", text: "" }
  return JSON.parse(first.text) as Record<string, unknown>
}

const connect = async (model?: ReturnType<typeof scriptedModel>) => {
  const board = await Effect.runPromise(makeBoard({ dataFile: undefined }))
  const server = makeBoardMcp({ board, model })
  const client = new Client({ name: "board-e2e", version: "0.0.0" })
  const pair = InMemoryTransport.createLinkedPair()
  await server.connect(pair[0])
  await client.connect(pair[1])
  return { board, client, close: async () => { await client.close().catch(() => undefined) } }
}

describe("board MCP: tools round-trip as JSON text", () => {
  test("create -> start (granted) -> done with detail", async () => {
    const { client, close } = await connect()
    await call(client, "board_create_resource", { resourceId: "ws", kind: "workspace", name: "ws", capacity: 1, concurrency: "exclusive" })
    const created = await call(client, "board_create_item", { title: "via mcp", requires: JSON.stringify([{ resourceId: "ws" }]) })
    const itemId = created.itemId as string
    expect(typeof itemId).toBe("string")
    const started = await call(client, "board_start", { itemId, executorId: "claude" })
    expect(started.state).toBe("doing")
    const doneResult = await call(client, "board_report_done", { itemId, detail: "worked" })
    expect(doneResult.outcome).toBe("done")
    const got = await call(client, "board_get_item", { itemId })
    expect((got.item as { state: string }).state).toBe("done")
    const events = await call(client, "board_events", { ts: 0 })
    const eventList = events.events as Array<{ type: string }>
    expect(eventList.map((e) => e.type)).toContain("resource.acquired")
    expect(eventList.map((e) => e.type)).toContain("resource.released")
    await close()
  })

  test("two MCP executors contend on one exclusive resource", async () => {
    const { client, close } = await connect()
    await call(client, "board_create_resource", { resourceId: "ws", kind: "workspace", name: "ws", capacity: 1, concurrency: "exclusive" })
    const a = (await call(client, "board_create_item", { title: "A", requires: "ws" })).itemId as string
    const b = (await call(client, "board_create_item", { title: "B", requires: "ws" })).itemId as string
    expect((await call(client, "board_start", { itemId: a, executorId: "e1" })).state).toBe("doing")
    expect((await call(client, "board_start", { itemId: b, executorId: "e2" })).state).toBe("blocked")
    await call(client, "board_report_done", { itemId: a })
    const gotB = await call(client, "board_get_item", { itemId: b })
    expect((gotB.item as { state: string }).state).toBe("doing")
    await close()
  })

  test("board_view + board_list + board_state are consistent", async () => {
    const { client, close } = await connect()
    await call(client, "board_create_item", { title: "k1" })
    await call(client, "board_create_item", { title: "k2", labels: "[\"ops\"]" })
    const view = await call(client, "board_view", {})
    const todo = (view.view as { columns: Array<{ id: string; itemIds: string[] }> }).columns.find((c) => c.id === "todo")
    expect(todo?.itemIds.length).toBe(2)
    const list = await call(client, "board_list", {})
    expect((list.items as unknown[]).length).toBe(2)
    const state = await call(client, "board_state", {})
    expect((state.items as unknown[]).length).toBe(2)
    await close()
  })
})

describe("board MCP: coordinator via tool (model configured)", () => {
  test("board_coordinate plans children for a goal item", async () => {
    const board = await Effect.runPromise(makeBoard({ dataFile: undefined }))
    const goalItem = await Effect.runPromise(board.createItem({ title: "the goal" }))
    const goalId = goalItem.itemId
    const script = [
      { text: "", toolCalls: [{ id: "v", name: "board_view", input: {} }] },
      { text: "", toolCalls: [{ id: "c", name: "board_create_item", input: { title: "child 1", parentId: goalId } }] },
      { text: JSON.stringify({ summary: "planned", done: true, created: [] }), toolCalls: [] }
    ]
    const server = makeBoardMcp({ board, model: scriptedModel(script) })
    const client = new Client({ name: "board-e2e", version: "0.0.0" })
    const pair = InMemoryTransport.createLinkedPair()
    await server.connect(pair[0])
    await client.connect(pair[1])
    const reply = await call(client, "board_coordinate", { itemId: goalId })
    expect(reply.ok).toBe(true)
    const got = await call(client, "board_get_item", { itemId: goalId })
    expect((got.item as { children: string[] }).children.length).toBe(1)
    await client.close().catch(() => undefined)
  })
})

describe("board MCP: no model, no coordinate tool", () => {
  test("board_coordinate is not registered", async () => {
    const { client, close } = await connect()
    let unavailable = false
    try {
      const result = (await client.callTool({ name: "board_coordinate", arguments: { itemId: "x" } })) as { content: ReadonlyArray<{ text?: string }> }
      const text = result.content[0]?.text ?? ""
      unavailable = /not found|unknown|no tool/i.test(text)
    } catch {
      unavailable = true
    }
    expect(unavailable).toBe(true)
    await close()
  })
})
