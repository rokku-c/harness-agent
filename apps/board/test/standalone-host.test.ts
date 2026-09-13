import { expect, test } from "bun:test"
import { existsSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { startStandaloneApp } from "@effect-agent/effect-standalone"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { effectApp } from "../src/effect-app.ts"

const dataFile = (): string => join(mkdtempSync(join(tmpdir(), "board-standalone-")), "board.sqlite")

test("a no-dependency app hosts alone and answers a real MCP client over a real socket", async () => {
  const hosted = await startStandaloneApp({ app: effectApp, port: 0, config: { dataFile: dataFile() } })
  let client: Client | undefined
  try {
    expect(hosted.app).toBe("board")
    expect(hosted.surface).toEqual(["mcp:/mcp"])
    expect(new URL(hosted.url).port).not.toBe("")

    client = new Client({ name: "standalone-board", version: "0.0.1" })
    await client.connect(new StreamableHTTPClientTransport(new URL(hosted.mcpUrl)))
    expect((await client.listTools()).tools.map((t) => t.name)).toContain("board_state")

    const created = await client.callTool({ name: "board_create", arguments: { title: "hosted-alone", body: "", state: "todo" } })
    expect(created.isError).not.toBe(true)
    const state = await client.callTool({ name: "board_state", arguments: {} })
    const payload = JSON.parse((state.content as Array<{ type: string; text: string }>)[0]!.text) as {
      counts?: Record<string, number>
    }
    expect(payload.counts?.todo).toBe(1)

    // Hosted alone means the MCP face: the app's own console route and the
    // composition root's control plane are not served on this port.
    expect((await fetch(new URL("/board", hosted.url))).status).toBe(404)
    expect((await fetch(new URL("/-/planes", hosted.url))).status).toBe(404)
  } finally {
    await client?.close().catch(() => undefined)
    await hosted.stop()
  }
})

test("stopping the standalone host releases the port", async () => {
  const hosted = await startStandaloneApp({ app: effectApp, port: 0, config: { dataFile: dataFile() } })
  const port = new URL(hosted.url).port
  await hosted.stop()
  const reused = Bun.serve({ port: Number(port), fetch: () => new Response("reused") })
  try {
    expect(reused.port).toBe(Number(port))
  } finally {
    reused.stop(true)
  }
})

test("an override layer moves the app off the file its manifest names", async () => {
  const named = dataFile(), moved = dataFile()
  const hosted = await startStandaloneApp({
    app: effectApp, port: 0, config: { dataFile: named }, override: { dataFile: moved },
  })
  try {
    // The resolved value is asserted by the field this test is about, not as a
    // whole object: a config that grows a field with a default moves that object
    // without changing what an override means.
    expect((hosted.config.value as { dataFile?: string }).dataFile).toBe(moved)
    expect(hosted.config.sources.dataFile).toBe("override")
    // The app opened the file it was told to open, and never touched the one the
    // manifest named — which is the only thing this flag exists to guarantee.
    expect(existsSync(moved)).toBe(true)
    expect(existsSync(named)).toBe(false)
  } finally { await hosted.stop() }
})
