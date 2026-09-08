import { expect, test } from "bun:test"

import { makeEffectRegistry, invoke } from "@effect-agent/effect-interface"
import { buildNodeMcpServer, connectNodeToHome } from "../src/index.ts"

const nodeRegistry = (name: string, out: string) => {
  const registry = makeEffectRegistry()
  registry.registerInterface({
    id: "node",
    tools: [{
      name,
      description: name,
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      handler: async (args: unknown) => ({ text: (args as { text: string }).text, tag: out }),
    }],
  })
  return registry
}

test("an in-proc app registers into home as a real MCP server/client pair", async () => {
  const home = makeEffectRegistry()
  const connected = await connectNodeToHome({
    ns: "ops",
    appId: "board",
    server: buildNodeMcpServer(nodeRegistry("echo", "board")),
    homeRegistry: home,
  })

  const keys = home.tools().map((t) => t.key)
  expect(keys).toContain("ops::board.echo")

  const tool = home.tools().find((t) => t.key === "ops::board.echo")
  expect(tool).toBeDefined()
  expect(await invoke(tool!.tool, { text: "via mcp" })).toEqual({ text: "via mcp", tag: "board" })

  await connected.dispose()
  expect(home.tools()).toHaveLength(0)
})

test("two namespaced in-proc apps coexist and register through MCP", async () => {
  const home = makeEffectRegistry()
  const a = await connectNodeToHome({
    ns: "ops", appId: "board",
    server: buildNodeMcpServer(nodeRegistry("echo", "board")),
    homeRegistry: home,
  })
  const b = await connectNodeToHome({
    ns: "workspace-b", appId: "probe",
    server: buildNodeMcpServer(nodeRegistry("ping", "probe")),
    homeRegistry: home,
  })

  expect(home.tools().map((t) => t.key).sort()).toEqual(["ops::board.echo", "workspace-b::probe.ping"])

  const ping = home.tools().find((t) => t.key === "workspace-b::probe.ping")
  expect(await invoke(ping!.tool, { text: "hi" })).toEqual({ text: "hi", tag: "probe" })

  await a.dispose()
  expect(home.tools().map((t) => t.key)).toEqual(["workspace-b::probe.ping"])
  await b.dispose()
  expect(home.tools()).toHaveLength(0)
})

test("an authorize() gate blocks forwarding before it reaches the MCP client", async () => {
  const home = makeEffectRegistry()
  const connected = await connectNodeToHome({
    ns: "ops", appId: "board",
    server: buildNodeMcpServer(nodeRegistry("echo", "board")),
    homeRegistry: home,
    authorize: () => false,
  })
  const tool = home.tools().find((t) => t.key === "ops::board.echo")
  await expect(invoke(tool!.tool, { text: "x" })).rejects.toThrow("denied")
  await connected.dispose()
})
