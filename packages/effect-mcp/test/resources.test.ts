import { expect, test } from "bun:test"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { buildNodeMcpServer, type NodeResourcePlanes } from "../src/index.ts"

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

/** A node server on one end of an in-memory pair, a home client on the other. */
const serve = async (planes?: NodeResourcePlanes) => {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair()
  const server = buildNodeMcpServer(registry("board"), planes)
  const client = new Client({ name: "effect-home", version: "0.1.0" })
  await server.connect(serverSide)
  await client.connect(clientSide)
  return { client }
}

const textOf = (result: unknown): unknown =>
  JSON.parse((result as { contents: Array<{ text: string }> }).contents[0].text)

test("the ui and store planes are served as MCP resources a home can read", async () => {
  const ui: NodeResourcePlanes["ui"] = {
    main: { title: "Board", tabs: ["a", "b"] },
    "settings/theme": { accent: "#0af" },
  }
  const store: NonNullable<NodeResourcePlanes["store"]> = {
    list: () => ["greeting"],
    get: (key) => (key === "greeting" ? { hello: "world" } : undefined),
  }

  const { client } = await serve({ ui, store })
  const listed = (await client.listResources()).resources

  expect(listed.map((r) => r.uri).sort()).toEqual([
    "store://greeting", "ui://main", "ui://settings_theme",
  ])
  expect(new Map(listed.map((r) => [r.uri, r.name])).get("ui://main")).toBe("ui:main")
  // A view id is not a URI: the slash in `settings/theme` cannot stay one.
  expect(textOf(await client.readResource({ uri: "ui://settings_theme" }))).toEqual({ accent: "#0af" })
  expect(textOf(await client.readResource({ uri: "store://greeting" }))).toEqual({ hello: "world" })

  // The store is a plane with an owner: an unknown key is an error, not an empty read.
  await expect(client.readResource({ uri: "store://absent" })).rejects.toThrow()
  await client.close()
  await expect(client.readResource({ uri: "store://greeting" })).rejects.toThrow()
})

test("a node with no planes still serves its tools, and claims no resources", async () => {
  const { client } = await serve()

  // Not "an empty list": the capability is absent, so the protocol refuses the
  // method — which is what a home that checks before listing is relying on.
  expect(client.getServerCapabilities()?.resources).toBeUndefined()
  await expect(client.listResources()).rejects.toThrow()
  expect((await client.listTools()).tools.map((t) => t.name)).toContain("echo")
  await client.close()
})
