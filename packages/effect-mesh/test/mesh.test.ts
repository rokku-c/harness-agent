import { expect, test } from "bun:test"

import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makeMesh } from "../src/index.ts"

const registryFor = (ns: string, appId: string) => {
  const registry = makeEffectRegistry()
  registry.registerInterface({
    id: `${ns}::${appId}`,
    tools: [
      {
        name: "echo",
        description: "echo text back",
        inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
        handler: async (args: unknown) => ({ text: (args as { text: string }).text }),
      },
    ],
  })
  return registry
}

test("nodes announce into namespaces and are isolated by default", async () => {
  const mesh = makeMesh()
  mesh.announce({ ns: "ops", appId: "app-one", registry: registryFor("ops", "app-one"), capabilities: ["echo"] })
  mesh.announce({ ns: "workspace-a", appId: "app-one", registry: registryFor("workspace-a", "app-one"), capabilities: ["echo"] })

  expect(mesh.list()).toHaveLength(2)
  expect(mesh.discover({ capability: "echo", ns: "ops" }).map((n) => n.key)).toEqual(["ops::app-one"])

  // same-namespace call works
  expect(await mesh.call({ ns: "ops", appId: "app-one", tool: "echo" }, { text: "hi" })).toEqual({ text: "hi" })

  // cross-namespace is blocked unless granted
  await expect(
    mesh.call({ ns: "ops", appId: "app-one", tool: "echo" }, { text: "x" }, { byNamespace: "workspace-a" }),
  ).rejects.toThrow("namespace isolated")

  mesh.grant("workspace-a", "ops")
  expect(await mesh.call({ ns: "ops", appId: "app-one", tool: "echo" }, { text: "ok" }, { byNamespace: "workspace-a" })).toEqual({ text: "ok" })
  mesh.revoke("workspace-a", "ops")
  await expect(
    mesh.call({ ns: "ops", appId: "app-one", tool: "echo" }, { text: "x" }, { byNamespace: "workspace-a" }),
  ).rejects.toThrow("namespace isolated")
})

test("announce disposer and leave remove a node", () => {
  const mesh = makeMesh()
  const leave = mesh.announce({ ns: "n", appId: "a", registry: registryFor("n", "a") })
  expect(mesh.list().map((n) => n.key)).toEqual(["n::a"])
  leave()
  expect(mesh.list()).toHaveLength(0)
  mesh.announce({ ns: "n", appId: "a", registry: registryFor("n", "a") })
  expect(mesh.leave("n::a")).toBe(true)
  expect(mesh.list()).toHaveLength(0)
})
