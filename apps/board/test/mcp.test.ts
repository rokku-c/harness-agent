import { expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { makeBoard } from "../src/board.ts"
import { makeBoardMcp } from "../src/hosts/mcp/board-mcp.ts"

test("MCP exposes the task and run tools, and writes the same underlying board", async () => {
  const board = makeBoard(), server = makeBoardMcp(board)
  const client = new Client({ name: "test", version: "1" })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(a); await client.connect(b)
  try {
    expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual([
      "board_agents", "board_calendar", "board_create", "board_delete", "board_doc_apply", "board_doc_create",
      "board_doc_delete", "board_doc_get", "board_doc_list", "board_events", "board_get", "board_health",
      "board_run_finish", "board_run_progress", "board_run_start", "board_runs", "board_state", "board_sync",
      "board_table", "board_tree", "board_update",
    ])
    const result = await client.callTool({ name: "board_create", arguments: { title: "via-mcp" } })
    expect(result.isError).not.toBe(true)
    expect(board.list().map((t) => t.title)).toEqual(["via-mcp"])
    const invalid = await client.callTool({ name: "board_create", arguments: { title: "bad", dependsOn: ["nope"] } })
    expect(invalid.isError).toBe(true)
    expect(board.list()).toHaveLength(1)
  } finally { await client.close(); await server.close(); board.close() }
})
