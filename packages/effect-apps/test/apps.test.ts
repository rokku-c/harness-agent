import { expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { buildAppsMcpServer, makeAppCatalog } from "../src/index.ts"

import { resultText as text } from "./fixtures.ts"

const makeStore = () => {
  const data = new Map<string, unknown>()
  return {
    get: (k: string) => data.get(k),
    set: (k: string, v: unknown) => { data.set(k, v) },
    delete: (k: string) => data.delete(k),
    list: (prefix = "") => [...data.keys()].filter((k) => k.startsWith(prefix)),
  }
}

test("an MCP home browses and operates every app in the catalog", async () => {
  const board = makeEffectRegistry()
  board.registerInterface({
    id: "ops::board",
    tools: [{
      name: "echo",
      description: "echo text back",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      handler: async (a: unknown) => ({ text: String((a as { text: string }).text).toUpperCase() }),
    }],
  })
  const notes = makeEffectRegistry()
  notes.registerInterface({
    id: "work::notes",
    tools: [{ name: "ping", description: "ping", inputSchema: { type: "object", properties: {} }, handler: async () => ({ pong: true }) }],
  })
  const store = makeStore()
  store.set("theme", "dark")

  const catalog = makeAppCatalog()
  catalog.register({
    ns: "ops",
    appId: "board",
    registry: board,
    authorize: () => true,
    ui: { doc: () => ({ kind: "document", view: "board" }), state: () => ({ open: true }) },
    config: { schema: () => ({ type: "object" }), value: () => ({ theme: "dark" }), sources: () => ({ theme: "yaml" }) },
    store,
  })
  catalog.register({ ns: "work", appId: "notes", registry: notes, authorize: () => false })

  const server = buildAppsMcpServer(catalog)
  const client = new Client({ name: "effect-apps-test", version: "0.0.0" })
  const pair = InMemoryTransport.createLinkedPair()
  await server.connect(pair[0])
  await client.connect(pair[1])

  const names = (await client.listTools()).tools.map((t) => t.name).sort()
  expect(names).toEqual(["app_call", "app_read", "apps_list"])

  const listed = JSON.parse(text(await client.callTool({ name: "apps_list" })))
  expect(listed).toEqual([
    { ns: "ops", appId: "board", hasInterface: true, hasUi: true, hasConfig: true, hasStore: true },
  ])

  const read = (args: Record<string, unknown>) => client.callTool({ name: "app_read", arguments: args })
  expect(JSON.parse(text(await read({ ns: "ops", appId: "board", part: "ui" })))).toEqual({ kind: "document", view: "board" })
  expect(JSON.parse(text(await read({ ns: "ops", appId: "board", part: "state" })))).toEqual({ open: true })
  expect(JSON.parse(text(await read({ ns: "ops", appId: "board", part: "config" })))).toEqual({
    schema: { type: "object" },
    value: { theme: "dark" },
    sources: { theme: "yaml" },
  })
  expect(JSON.parse(text(await read({ ns: "ops", appId: "board", part: "store", key: "theme" })))).toBe("dark")
  expect(JSON.parse(text(await read({ ns: "ops", appId: "board", part: "store" })))).toEqual({ theme: "dark" })

  const echo = await client.callTool({ name: "app_call", arguments: { ns: "ops", appId: "board", tool: "echo", arguments: { text: "hi" } } })
  expect(JSON.parse(text(echo))).toEqual({ text: "HI" })

  const denied = await client.callTool({ name: "app_read", arguments: { ns: "work", appId: "notes", part: "ui" } })
  expect(denied.isError).toBe(true)
  expect(text(denied)).toContain("denied")

  await client.close()
})
