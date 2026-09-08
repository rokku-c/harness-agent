import { expect, test } from "bun:test"

import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { buildNodeMcpServer, connectNodeToHome, type NodeResourcePlanes } from "../src/index.ts"

const registry = (out: string) => {
  const reg = makeEffectRegistry()
  reg.registerInterface({
    id: "node",
    tools: [{
      name: "echo",
      description: "echo",
      handler: async () => ({ ok: true, tag: out }),
    }],
  })
  return reg
}

test("node ui/store planes are exposed as MCP resources to the home", async () => {
  const ui: NodeResourcePlanes["ui"] = {
    main: { title: "Board", tabs: ["a", "b"] },
    "settings/theme": { accent: "#0af" },
  }
  const store: NonNullable<NodeResourcePlanes["store"]> = {
    list: () => ["greeting"],
    get: (key) => (key === "greeting" ? { hello: "world" } : undefined),
  }

  const home = makeEffectRegistry()
  const connected = await connectNodeToHome({
    ns: "ops",
    appId: "board",
    server: buildNodeMcpServer(registry("board"), { ui, store }),
    homeRegistry: home,
  })

  const uris = connected.resources.map((r) => r.uri).sort()
  expect(uris).toContain("ui://main")
  expect(uris).toContain("ui://settings_theme")
  expect(uris).toContain("store://greeting")

  const byName = new Map(connected.resources.map((r) => [r.uri, r.name]))
  expect(byName.get("ui://main")).toBe("ui:main")
  expect(byName.get("store://greeting")).toBe("greeting")

  expect(await connected.readResource("ui://main")).toEqual({ title: "Board", tabs: ["a", "b"] })
  expect(await connected.readResource("ui://settings_theme")).toEqual({ accent: "#0af" })
  expect(await connected.readResource("store://greeting")).toEqual({ hello: "world" })

  await connected.dispose()
  expect(home.tools()).toHaveLength(0)
  await expect(connected.readResource("store://greeting")).rejects.toThrow()
})

test("resource registration is optional — a tool-only server still connects", async () => {
  const home = makeEffectRegistry()
  const connected = await connectNodeToHome({
    ns: "ops",
    appId: "board",
    server: buildNodeMcpServer(registry("board")),
    homeRegistry: home,
  })

  expect(connected.resources).toEqual([])
  expect(home.tools().map((t) => t.key)).toContain("ops::board.echo")
  await connected.dispose()
})
