import { expect, test } from "bun:test"

import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makeNodeStore, makePlanes } from "../src/index.ts"

const bRegistry = makeEffectRegistry()
bRegistry.registerInterface({
  id: "ops::board",
  tools: [{ name: "view", description: "board view", inputSchema: { type: "object", properties: {} }, handler: async () => ({ ok: true }) }],
})

const planes = makePlanes()
const boardStore = makeNodeStore()
boardStore.set("state", { items: 3 })

planes.registerNode({
  ns: "ops",
  appId: "board",
  store: boardStore,
  uiDoc: () => ({ lang: "effect-ui", view: { viewId: "board", nodes: [{ kind: "text", text: "board console" }] } }),
  registry: bRegistry,
})

test("same namespace can read its own interface/ui/store", () => {
  expect(planes.can("ops", "ops", "interface")).toBe(true)
  expect(planes.readStore("ops", "ops", "board", "state")).toEqual({ items: 3 })
  expect((planes.readUi("ops", "ops", "board") as { view: { nodes: unknown[] } }).view.nodes).toHaveLength(1)
  expect((planes.readInterface("ops", "ops", "board") as unknown[]).length).toBe(1)
})

test("cross-namespace reads are denied by default per plane", () => {
  expect(planes.can("workspace-a", "ops", "store")).toBe(false)
  expect(() => planes.readStore("workspace-a", "ops", "board", "state")).toThrow("denied")
  expect(() => planes.readUi("workspace-a", "ops", "board")).toThrow("denied")
  expect(() => planes.readInterface("workspace-a", "ops", "board")).toThrow("denied")
})

test("granting a plane opens only that plane", () => {
  planes.grant("workspace-a", "ops", ["store"])
  expect(planes.readStore("workspace-a", "ops", "board", "state")).toEqual({ items: 3 })
  expect(() => planes.readUi("workspace-a", "ops", "board")).toThrow("denied")

  planes.grant("workspace-a", "ops", ["ui", "interface"])
  expect((planes.readUi("workspace-a", "ops", "board") as { lang: string }).lang).toBe("effect-ui")
  expect((planes.readInterface("workspace-a", "ops", "board") as unknown[]).length).toBe(1)

  // write stays separate from read
  expect(() => planes.writeStore("workspace-a", "ops", "board", "state", { items: 9 })).toThrow("denied")
  planes.grant("workspace-a", "ops", ["store-write"])
  planes.writeStore("workspace-a", "ops", "board", "state", { items: 9 })
  expect(planes.readStore("workspace-a", "ops", "board", "state")).toEqual({ items: 9 })

  planes.revoke("workspace-a", "ops", ["store"])
  expect(() => planes.readStore("workspace-a", "ops", "board", "state")).toThrow("denied")
})
