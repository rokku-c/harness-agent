import { expect, test } from "bun:test"

import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { connectNodeViaMemory, dispatchMeshJson, makeMesh } from "../src/index.ts"

const leafFor = (ns: string, appId: string) => {
  const node = makeMesh()
  const registry = makeEffectRegistry()
  registry.registerInterface({
    id: `${ns}::${appId}`,
    tools: [{
      name: "echo",
      description: "echo text back",
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      handler: async (args: unknown) => ({ text: (args as { text: string }).text }),
    }],
  })
  node.announce({ ns, appId, registry, capabilities: ["echo"] })
  return node
}

test("a same-process node is reached ONLY through the protocol (home holds a remote, no registry)", async () => {
  const audit: unknown[] = []
  const home = makeMesh({ onCall: (a) => void audit.push(a) })
  const node = leafFor("ops", "app-one")

  connectNodeViaMemory(home, node, { ns: "ops", appId: "app-one", capabilities: ["echo"] })
  // home node has no local registry — it must be reached through the protocol
  const homeNode = home.list()[0]
  expect(homeNode.key).toBe("ops::app-one")

  const result = await home.call({ ns: "ops", appId: "app-one", tool: "echo" }, { text: "protocol only" })
  expect(result).toEqual({ text: "protocol only" })

  // audit fired on the home before the protocol round trip
  expect(audit).toHaveLength(1)
  expect(audit[0]).toMatchObject({ ns: "ops", appId: "app-one", tool: "echo" })

  // a serialized-envelope path also works (this is the wire shape)
  const dispatched = await dispatchMeshJson(home, "mesh/call", {
    ns: "ops", appId: "app-one", tool: "echo", arguments: { text: "wire" }, byNamespace: "ops",
  })
  expect(dispatched).toEqual({ ok: true, result: { text: "wire" } })
})

test("audit hook can gate calls (throw blocks the protocol round trip)", async () => {
  const home = makeMesh({ onCall: () => { throw new Error("denied by audit") } })
  const node = leafFor("ops", "gate")
  connectNodeViaMemory(home, node, { ns: "ops", appId: "gate", capabilities: ["echo"] })

  await expect(home.call({ ns: "ops", appId: "gate", tool: "echo" }, { text: "x" })).rejects.toThrow("denied by audit")
})

test("namespace isolation still applies to protocol nodes", async () => {
  const home = makeMesh()
  connectNodeViaMemory(home, leafFor("ops", "app-one"), { ns: "ops", appId: "app-one", capabilities: ["echo"] })
  await expect(
    home.call({ ns: "ops", appId: "app-one", tool: "echo" }, { text: "x" }, { byNamespace: "other" }),
  ).rejects.toThrow("namespace isolated")
})
