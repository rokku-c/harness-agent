import { expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { makeBoard } from "../src/board.ts"
import { makeBoardMcp } from "../src/hosts/mcp/board-mcp.ts"

test("MCP exposes only task tools and writes the same underlying board", async () => {
  const board = makeBoard(), server = makeBoardMcp(board)
  const client = new Client({ name: "test", version: "1" })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(a); await client.connect(b)
  try {
    expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual([
      "board_create", "board_delete", "board_events", "board_get", "board_state", "board_tree", "board_update",
    ])
    const result = await client.callTool({ name: "board_create", arguments: { title: "via-mcp" } })
    expect(result.isError).not.toBe(true)
    expect(board.list().map((t) => t.title)).toEqual(["via-mcp"])
    const invalid = await client.callTool({ name: "board_create", arguments: { title: "bad", dependsOn: ["nope"] } })
    expect(invalid.isError).toBe(true)
    expect(board.list()).toHaveLength(1)
  } finally { await client.close(); await server.close(); board.close() }
})
