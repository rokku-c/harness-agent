import { afterAll, beforeAll, expect, test } from "bun:test"

import { makeEffectRegistry, invoke } from "@effect-agent/effect-interface"
import { registerMcpPlugin } from "../src/registrar.ts"
import { handleMcpRequest } from "../src/mcp-http.ts"

let server: ReturnType<typeof Bun.serve>
const serverRegistry = makeEffectRegistry()

beforeAll(() => {
  serverRegistry.registerInterface({
    id: "svc",
    tools: [
      {
        name: "echo",
        description: "echo text back",
        inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
        handler: async (args) => {
          const text = (args as { text: string }).text
          return { text }
        },
      },
    ],
    apps: [{ id: "console", title: "svc console", resourceUri: "ui://svc/console" }],
  })
  server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: handleMcpRequest(serverRegistry) })
})

afterAll(() => {
  server.stop()
})

test("remote http plugin registers through the MCP client and proxies calls", async () => {
  const registry = makeEffectRegistry()
  const close = await registerMcpPlugin(registry, {
    id: "remote-svc",
    transport: "http",
    url: "http://127.0.0.1:" + server.port + "/mcp",
  })

  const keys = registry.tools().map((t) => t.key)
  expect(keys).toContain("remote-svc.svc.echo")

  const tool = registry.tools().find((t) => t.key === "remote-svc.svc.echo")
  expect(tool).toBeDefined()
  expect(await invoke(tool!.tool, { text: "over http" })).toMatchObject({ ok: true, text: expect.stringContaining("over http") })

  // UI app resources are discovered and registered alongside the tools
  expect(registry.apps().map((a) => a.app.resourceUri)).toContain("ui://svc/console")

  await close()
  expect(registry.schemas()).toHaveLength(0)
  expect(registry.apps()).toHaveLength(0)
})
