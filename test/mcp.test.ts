import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { any, bind, mcpConnection } from "../src/index.ts"

describe("mcp adapter", () => {
  test("mode 1 (any): an MCP server lands as an mcp__-prefixed connection", async () => {
    const conn = await Effect.runPromise(mcpConnection({
      name: "echo",
      command: process.execPath,
      args: ["test/fixtures/mcp-echo-server.mjs"]
    }))
    expect(conn.name).toBe("echo")
    expect(conn.tools.map((tool) => tool.name)).toEqual(["echo"])
    const bound = bind(any(), conn)
    expect(bound.map((tool) => tool.boundName)).toEqual(["mcp__echo"])
    const output = await Effect.runPromise(bound[0]!.execute({ text: "hello mcp" }))
    expect(JSON.stringify(output)).toContain("hello mcp")
  })
})
