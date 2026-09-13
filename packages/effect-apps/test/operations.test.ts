import { expect, test } from "bun:test"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { HOST_NODE, makeNodeOperationTable, operationAddress, type AppEntry } from "../src/index.ts"
import { appHost, plane } from "./fixtures.ts"

const iface = (id: string, name: string, description = name) => ({
  id,
  tools: [
    {
      name,
      description,
      inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      handler: async (args: unknown) => ({ echoed: args }),
    },
  ],
})

/** The catalog default is deny, so tests say which planes they allow. */
const app = (id: string, registry = makeEffectRegistry(), authorize: () => boolean = () => true): AppEntry => ({
  ns: id,
  appId: id,
  registry,
  authorize,
})

const withApp = (name = "echo") => {
  const registry = makeEffectRegistry()
  registry.registerInterface(iface("board", name))
  return app("board", registry)
}

const addresses = (table: ReturnType<typeof makeNodeOperationTable>): string[] =>
  table.list().map((operation) => operation.address).sort()

test("host and app operations are enumerated in one table", () => {
  const host = appHost()
  const table = makeNodeOperationTable(host.host, [withApp()])

  expect(addresses(table)).toEqual([
    "board::board::interface::echo",
    "host::lifecycle::disable",
    "host::lifecycle::enable",
    "host::lifecycle::list",
    "host::lifecycle::reload",
    "host::lifecycle::unregister",
  ])
})

test("privilege is a property of the entry, and only the host has it", () => {
  const host = appHost()
  const table = makeNodeOperationTable(host.host, [withApp()])

  expect(table.list().filter((operation) => operation.privileged).map((operation) => operation.name))
    .toEqual(["list", "enable", "disable", "reload", "unregister"])
  expect(table.resolve("board::board::interface::echo").privileged).toBe(false)
})

test("every operation carries a schema", () => {
  const host = appHost()
  const table = makeNodeOperationTable(host.host, [withApp()])

  for (const operation of table.list()) {
    expect(operation.description).toBeTruthy()
    expect(operation.inputSchema).toBeDefined()
    // the host side is fully declared (input + output); app tools may omit output
    if (operation.privileged) expect(operation.outputSchema).toBeDefined()
  }
  expect(table.resolve("board::board::interface::echo").inputSchema)
    .toEqual({ type: "object", properties: { text: { type: "string" } }, required: ["text"] })
})

test("a host operation invoked through the table moves the real lifecycle", async () => {
  const host = appHost()
  await host.host.register({ id: "board", enabled: false, load: async () => plane() })
  const table = makeNodeOperationTable(host.host, [])

  expect(await table.invoke("host::lifecycle::list", {})).toEqual([{ id: "board", enabled: false, priority: 100 }])
  expect(await table.invoke("host::lifecycle::enable", { id: "board" }))
    .toEqual({ ok: true, id: "board", enabled: true })
  expect(host.host.isEnabled("board")).toBe(true)
  expect(await table.invoke("host::lifecycle::unregister", { id: "board" })).toEqual({ ok: true })
  expect(host.host.list()).toEqual([])
})

test("a host operation refuses arguments that do not match its schema", async () => {
  const host = appHost()
  const table = makeNodeOperationTable(host.host, [])

  expect(() => table.invoke("host::lifecycle::enable", {})).toThrow(/requires a string "id"/)
  expect(() => table.invoke("host::lifecycle::enable", { id: 7 })).toThrow(/requires a string "id"/)
  // "list" declares no parameters, so nothing is demanded and nothing is read
  expect(await table.invoke("host::lifecycle::list", { id: "ignored" })).toEqual([])
})

test("an app operation runs through the same authorized invoke path", async () => {
  const host = appHost()
  const table = makeNodeOperationTable(host.host, [withApp()])

  expect(await table.invoke("board::board::interface::echo", { text: "hi" })).toEqual({ echoed: { text: "hi" } })
  // argument validation is the shared one, not a second implementation
  await expect(table.invoke("board::board::interface::echo", { text: 1 })).rejects.toThrow()
})

test("a denied app plane is absent from the table, not merely uninvokable", () => {
  const host = appHost()
  const registry = makeEffectRegistry()
  registry.registerInterface(iface("board", "echo"))
  const table = makeNodeOperationTable(host.host, [app("board", registry, () => false)])

  expect(addresses(table)).not.toContain("board::board::interface::echo")
  expect(table.find("board::board::interface::echo")).toBeUndefined()
  expect(() => table.resolve("board::board::interface::echo")).toThrow(/no operation/)
})

test("the catalog's own default is deny, and the table inherits it", () => {
  const host = appHost()
  const registry = makeEffectRegistry()
  registry.registerInterface(iface("board", "echo"))
  const bare: AppEntry = { ns: "board", appId: "board", registry }

  expect(addresses(makeNodeOperationTable(host.host, [bare]))).toEqual([
    "host::lifecycle::disable",
    "host::lifecycle::enable",
    "host::lifecycle::list",
    "host::lifecycle::reload",
    "host::lifecycle::unregister",
  ])
})

test("addresses are the same whether built by hand or by the table", () => {
  expect(operationAddress("host", "lifecycle", "enable")).toBe("host::lifecycle::enable")
  // an app node is itself `ns::appId`, so its address repeats the app id
  expect(operationAddress("board::board", "interface", "echo")).toBe("board::board::interface::echo")
  expect(HOST_NODE).toBe("host")
})

test("the table is a live view, not a snapshot", () => {
  const host = appHost()
  const apps: AppEntry[] = []
  const table = makeNodeOperationTable(host.host, apps)

  expect(addresses(table)).toHaveLength(5) // host only

  const registry = makeEffectRegistry()
  registry.registerInterface(iface("board", "echo"))
  apps.push(app("board", registry)) // the catalog grows after the table was built
  expect(addresses(table)).toContain("board::board::interface::echo")

  // a hot swap (§6.4) — the registry replaces the interface by id, and the table
  // shows the surface as it is now, with nothing to invalidate
  registry.registerInterface(iface("board", "ping"))
  expect(addresses(table)).toEqual([
    "board::board::interface::ping",
    "host::lifecycle::disable",
    "host::lifecycle::enable",
    "host::lifecycle::list",
    "host::lifecycle::reload",
    "host::lifecycle::unregister",
  ])
})
