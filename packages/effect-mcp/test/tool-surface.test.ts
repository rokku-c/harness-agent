import { expect, test } from "bun:test"
import { makeEffectRegistry, type EffectInterface } from "@effect-agent/effect-interface"
import { buildNodeMcpServer, emptyToolChange, toolChangeIsEmpty } from "../src/index.ts"

const iface = (name: string, description = name, id = "node"): EffectInterface => ({
  id,
  tools: [
    {
      name,
      description,
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      handler: async (args: unknown) => args,
    },
  ],
})

/** Build a server over a registry that already holds `ifaces` — the surface snapshots at build. */
const make = (...ifaces: EffectInterface[]) => {
  const registry = makeEffectRegistry()
  const disposers = ifaces.map((entry) => registry.registerInterface(entry))
  return { registry, server: buildNodeMcpServer(registry), disposers }
}

test("the surface starts from the registry at build time", () => {
  const { server } = make(iface("echo"))
  expect(server.toolSurface.names()).toEqual(["echo"])
})

test("a removed tool is retired from the surface", () => {
  const { server, disposers } = make(iface("echo"))

  disposers[0]()
  const change = server.toolSurface.refresh()

  expect(change).toEqual({ added: [], removed: ["echo"], updated: [] })
  expect(server.toolSurface.names()).toEqual([])
})

test("an added tool appears on the surface", () => {
  const { registry, server } = make(iface("echo"))

  registry.registerInterface(iface("ping", "ping", "other"))
  const change = server.toolSurface.refresh()

  expect(change).toEqual({ added: ["ping"], removed: [], updated: [] })
  expect(server.toolSurface.names()).toEqual(["echo", "ping"])
})

test("a re-described tool is updated in place, not duplicated", () => {
  const { registry, server } = make(iface("echo"))

  // same interface id → the registry replaces the record (the app hot-swap path)
  registry.registerInterface(iface("echo", "echoes back, loudly"))
  const change = server.toolSurface.refresh()

  expect(change).toEqual({ added: [], removed: [], updated: ["echo"] })
  expect(server.toolSurface.names()).toEqual(["echo"])
})

test("refreshing an unchanged registry is a no-op", () => {
  const { server } = make(iface("echo"))

  expect(server.toolSurface.refresh()).toEqual(emptyToolChange)
  expect(toolChangeIsEmpty(server.toolSurface.refresh())).toBe(true)
})

test("a swap that changes the tool set leaves exactly the new surface", () => {
  const { registry, server, disposers } = make(iface("echo"))
  expect(server.toolSurface.names()).toEqual(["echo"])

  // hot-swap: retire the old generation, install the new one, reconcile
  disposers[0]()
  registry.registerInterface(iface("ping"))
  const change = server.toolSurface.refresh()

  expect(change.added).toEqual(["ping"])
  expect(change.removed).toEqual(["echo"])
  expect(server.toolSurface.names()).toEqual(["ping"])
})
