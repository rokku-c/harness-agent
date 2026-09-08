import { expect, mock, test } from "bun:test"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { invokeAppTool, listAppTools, resolveAppTool, type AppEntry } from "../src/index.ts"

const fixture = () => {
  const registry = makeEffectRegistry()
  const other = mock(() => "other")
  registry.registerInterface({ id: "ops::notes", tools: [
    { name: "echo", handler: other }, { name: "secret", handler: other },
  ] })
  registry.registerInterface({ id: "work::board", tools: [{ name: "foreign", handler: other }] })
  registry.registerInterface({ id: "board", tools: [
    { name: "echo", handler: () => "legacy" }, { name: "ping", handler: () => "pong" },
  ] })
  registry.registerInterface({ id: "ops::board", tools: [{ name: "echo", handler: () => "board" }] })
  const app: AppEntry = { ns: "ops", appId: "board", registry, authorize: () => true }
  return { app, registry, other }
}

test("exact app interface + tool name; namespaced tools win over legacy duplicates", async () => {
  const { app, other } = fixture()
  expect(resolveAppTool(app, "echo").interfaceId).toBe("ops::board")
  expect(await invokeAppTool(app, "echo", {})).toBe("board")
  expect(await invokeAppTool(app, "ping", {})).toBe("pong")
  expect(listAppTools(app).map((entry) => entry.tool.name)).toEqual(["echo", "ping"])
  for (const name of ["secret", "foreign", "ops::notes.secret", "missing"]) {
    await expect(invokeAppTool(app, name, {})).rejects.toThrow("no tool")
  }
  expect(other).not.toHaveBeenCalled()
})

test("another app's same-name tool is never a fallback for an absent own tool", async () => {
  const { app, registry, other } = fixture()
  const empty = { ...app, appId: "absent" }
  expect(listAppTools(empty)).toEqual([])
  await expect(invokeAppTool(empty, "echo", {})).rejects.toThrow("no tool")
  const forged: AppEntry = { ...app, registry: { ...registry, tools: () => [{
    key: "ops::board.echo", interfaceId: "notes", tool: { name: "echo", handler: other },
  }] } }
  expect(() => resolveAppTool(forged, "echo")).toThrow("no tool")
  expect(other).not.toHaveBeenCalled()
})

test("missing/false authorization denies before registry access, including resolver", async () => {
  const { app, registry } = fixture()
  const read = mock(() => { throw new Error("registry leaked") })
  for (const authorize of [undefined, () => false]) {
    const denied = { ...app, authorize, registry: { ...registry, tools: read } }
    expect(listAppTools(denied)).toEqual([])
    expect(() => resolveAppTool(denied, "echo")).toThrow("denied")
    await expect(invokeAppTool(denied, "echo", {})).rejects.toThrow("denied")
  }
  expect(read).not.toHaveBeenCalled()
})

test("invocation rechecks authorization after an action was discovered", async () => {
  const { app } = fixture()
  let authorized = true
  const live = { ...app, authorize: () => authorized }
  expect(resolveAppTool(live, "echo").tool.name).toBe("echo")
  authorized = false
  await expect(invokeAppTool(live, "echo", {})).rejects.toThrow("denied")
})
