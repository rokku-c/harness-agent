import { expect, mock, test } from "bun:test"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { invokeAppTool, type AppEntry } from "@effect-agent/effect-apps"
import { fromCatalogEntry } from "../src/from-catalog.ts"

const entry = (): AppEntry => {
  const registry = makeEffectRegistry()
  for (const [id, names] of [
    ["ops::notes", ["echo", "secret"]], ["work::board", ["foreign"]],
    ["board", ["echo", "ping"]], ["ops::board", ["echo"]],
  ] as const) {
    registry.registerInterface({ id, tools: names.map((name) => ({
      name, description: id, handler: () => id,
      inputSchema: { type: "object", properties: { text: { type: "string" } } },
    })) })
  }
  return { ns: "ops", appId: "board", registry, authorize: () => true,
    ui: { doc: () => ({ view: "board" }), state: () => ({ count: 2 }) } }
}

test("parity lists only this app's actions using the exact invocation precedence", async () => {
  const app = entry()
  const view = fromCatalogEntry(app)
  expect(view.actions.map(({ name, description }) => ({ name, description }))).toEqual([
    { name: "echo", description: "ops::board" }, { name: "ping", description: "board" },
  ])
  expect(view.view).toEqual({ view: "board" })
  expect(view.state).toEqual({ count: 2 })
  for (const action of view.actions) {
    expect(await invokeAppTool(app, action.name, {})).toBe(action.description)
    expect(action.inputSchema).toEqual({ type: "object", properties: { text: { type: "string" } } })
  }
  expect(fromCatalogEntry({ ...app, appId: "absent" }).actions).toEqual([])
})

test("missing or denying authorization exposes neither actions nor UI and never reads them", () => {
  const app = entry()
  const secret = mock(() => { throw new Error("unauthorized read") })
  for (const authorize of [undefined, () => false]) {
    const view = fromCatalogEntry({ ...app, authorize,
      registry: { ...app.registry!, tools: secret }, ui: { doc: secret, state: secret } })
    expect(view.actions).toEqual([])
    expect(view.view).toBeUndefined()
    expect(view.state).toBeUndefined()
  }
  expect(secret).not.toHaveBeenCalled()
})

test("plane-specific authorization filters parity independently and revocation blocks invocation", async () => {
  const app = entry()
  let enabled = "interface"
  const scoped = { ...app, authorize: (plane: string) => plane === enabled }
  const actions = fromCatalogEntry(scoped)
  expect(actions.actions.map((action) => action.name)).toEqual(["echo", "ping"])
  expect(actions.view).toBeUndefined()
  expect(actions.state).toBeUndefined()
  enabled = "ui"
  const ui = fromCatalogEntry(scoped)
  expect(ui.actions).toEqual([])
  expect(ui.view).toEqual({ view: "board" })
  await expect(invokeAppTool(scoped, "echo", {})).rejects.toThrow("denied")
})
