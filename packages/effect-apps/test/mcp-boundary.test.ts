import { expect, mock, test } from "bun:test"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makeAppCatalog } from "../src/index.ts"
import { mcpClient, resultText } from "./fixtures.ts"

test("MCP app_call uses the shared scoped resolver and argument validation", async () => {
  const catalog = makeAppCatalog()
  const registry = makeEffectRegistry()
  const other = mock(() => "other")
  const own = mock((input: unknown) => input)
  registry.registerInterface({ id: "notes", tools: [
    { name: "echo", handler: other }, { name: "secret", handler: other },
  ] })
  registry.registerInterface({ id: "board", tools: [{ name: "echo", handler: own,
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  }] })
  catalog.register({ ns: "ops", appId: "board", registry, authorize: () => true })
  catalog.register({ ns: "ops", appId: "absent", registry, authorize: () => true })
  const client = await mcpClient(catalog)
  try {
    const call = (appId: string, tool: string, args: Record<string, unknown> = {}) => client.callTool({
      name: "app_call", arguments: { ns: "ops", appId, tool, arguments: args },
    })
    expect(JSON.parse(resultText(await call("board", "echo", { text: "hi" })))).toEqual({ text: "hi" })
    expect((await call("board", "echo", { text: 1 })).isError).toBe(true)
    expect((await call("board", "secret")).isError).toBe(true)
    expect((await call("absent", "echo")).isError).toBe(true)
    expect(own).toHaveBeenCalledTimes(1)
    expect(other).not.toHaveBeenCalled()
  } finally { await client.close() }
})

test("directory and plane reads hide denied planes; no authorize means deny", async () => {
  const catalog = makeAppCatalog()
  const readSecret = mock(() => { throw new Error("secret was read") })
  const registry = makeEffectRegistry()
  registry.registerInterface({ id: "board", tools: [{ name: "echo", handler: readSecret }] })
  const planes = { registry, ui: { doc: readSecret, state: readSecret },
    config: { schema: readSecret, value: readSecret, sources: readSecret },
    store: { get: readSecret, list: readSecret, set: readSecret, delete: readSecret } }
  catalog.register({ ns: "ops", appId: "board", ...planes })
  catalog.register({ ns: "ops", appId: "denied", ...planes, authorize: () => false })
  catalog.register({ ns: "ops", appId: "partial", ...planes,
    authorize: (plane) => plane === "ui", ui: { doc: () => ({ view: "public" }) } })
  const client = await mcpClient(catalog)
  try {
    expect(JSON.parse(resultText(await client.callTool({ name: "apps_list" })))).toEqual([
      { ns: "ops", appId: "partial", hasInterface: false, hasUi: true, hasConfig: false, hasStore: false },
    ])
    for (const appId of ["board", "denied"]) {
      for (const part of ["ui", "state", "config", "store"]) {
        const result = await client.callTool({ name: "app_read", arguments: { ns: "ops", appId, part } })
        expect(result.isError).toBe(true)
        expect(resultText(result)).toContain("denied")
      }
      expect((await client.callTool({ name: "app_call",
        arguments: { ns: "ops", appId, tool: "echo" } })).isError).toBe(true)
    }
    expect((await client.callTool({ name: "app_read",
      arguments: { ns: "ops", appId: "partial", part: "config" } })).isError).toBe(true)
    expect(readSecret).not.toHaveBeenCalled()
  } finally { await client.close() }
})
