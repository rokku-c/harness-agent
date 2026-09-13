import { expect, test } from "bun:test"

import type { Principal } from "@effect-agent/effect-authz"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { makeNodeStore, makePlanes } from "../src/index.ts"

const ops: Principal = { kind: "app", id: "ops" }
const workspaceA: Principal = { kind: "app", id: "workspace-a" }
const alice: Principal = { kind: "user", id: "ops" }

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

test("a principal in a namespace reads its own interface, ui and store", () => {
  expect(planes.can(ops, "ops", "interface")).toBe(true)
  expect(planes.readStore(ops, "ops", "board", "state")).toEqual({ items: 3 })
  expect((planes.readUi(ops, "ops", "board") as { view: { nodes: unknown[] } }).view.nodes).toHaveLength(1)
  expect((planes.readInterface(ops, "ops", "board") as unknown[]).length).toBe(1)
})

test("the namespace is the principal id, not its kind", () => {
  expect(planes.can(alice, "ops", "store")).toBe(true)
  expect(planes.can({ kind: "user", id: "elsewhere" }, "ops", "store")).toBe(false)
})

test("cross-namespace reads are denied by default per plane", () => {
  expect(planes.can(workspaceA, "ops", "store")).toBe(false)
  expect(() => planes.readStore(workspaceA, "ops", "board", "state")).toThrow("denied")
  expect(() => planes.readUi(workspaceA, "ops", "board")).toThrow("denied")
  expect(() => planes.readInterface(workspaceA, "ops", "board")).toThrow("denied")
})

test("an unauthorized caller cannot tell a missing node from a denied one", () => {
  expect(() => planes.readStore(workspaceA, "ops", "board", "state")).toThrow("denied")
  expect(() => planes.readStore(workspaceA, "ghost", "ghost", "state")).toThrow("denied")
})

test("granting a plane opens only that plane", () => {
  planes.grant(workspaceA, "ops", ["store"])
  expect(planes.readStore(workspaceA, "ops", "board", "state")).toEqual({ items: 3 })
  expect(() => planes.readUi(workspaceA, "ops", "board")).toThrow("denied")

  planes.grant(workspaceA, "ops", ["ui", "interface"])
  expect((planes.readUi(workspaceA, "ops", "board") as { lang: string }).lang).toBe("effect-ui")
  expect((planes.readInterface(workspaceA, "ops", "board") as unknown[]).length).toBe(1)

  // write stays separate from read
  expect(() => planes.writeStore(workspaceA, "ops", "board", "state", { items: 9 })).toThrow("denied")
  planes.grant(workspaceA, "ops", ["store-write"])
  planes.writeStore(workspaceA, "ops", "board", "state", { items: 9 })
  expect(planes.readStore(workspaceA, "ops", "board", "state")).toEqual({ items: 9 })

  planes.revoke(workspaceA, "ops", ["store"])
  expect(() => planes.readStore(workspaceA, "ops", "board", "state")).toThrow("denied")
})

test("a grant reaches the named namespace and no further", () => {
  planes.grant(workspaceA, "warehouse", ["store"])
  expect(planes.can(workspaceA, "warehouse", "store")).toBe(true)
  expect(planes.can(workspaceA, "ops", "store")).toBe(false)
})

test("an explicit deny beats the self-rule", () => {
  planes.authz.grant({ subject: "app:ops", resource: "store://ops/board", actions: ["read"], effect: "deny", source: "operator" })
  expect(() => planes.readStore(ops, "ops", "board", "state")).toThrow("denied")
  planes.authz.revoke("app:ops", "store://ops/board", ["read"])
  expect(planes.readStore(ops, "ops", "board", "state")).toBeDefined()
})

test("a shared engine lets two nodes weigh one table", () => {
  const shared = makePlanes()
  expect(planes.authz).not.toBe(shared.authz)
  shared.grant(workspaceA, "ops", ["store"])
  expect(shared.can(workspaceA, "ops", "store")).toBe(true)
  expect(planes.can(workspaceA, "ops", "store")).toBe(false)
})

test("a grant in another vocabulary does not open a plane", () => {
  const fresh: Principal = { kind: "app", id: "fresh" }
  planes.authz.grant({ subject: "app:fresh", resource: "mcp://ops/widget", actions: ["call"] })
  expect(planes.can(fresh, "ops", "interface")).toBe(false)
  expect(planes.can(fresh, "ops", "store")).toBe(false)
  expect(planes.can(fresh, "ops", "store-write")).toBe(false)
})
