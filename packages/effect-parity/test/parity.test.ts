import { expect, test } from "bun:test"
import { makeAppCatalog, type AppEntry } from "@effect-agent/effect-apps"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import {
  fromCatalogEntry,
  interactiveSpec,
  parityFromSnapshot,
  submitAction,
  type ObservationSnapshot,
} from "../src/index.ts"

/** A fake catalog app: one interface tool (echo) + a ui doc + live state. */
const makeEntry = (): AppEntry => {
  const registry = makeEffectRegistry()
  registry.registerInterface({
    id: "ops::board",
    tools: [{
      name: "echo",
      description: "echo text back",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string", description: "text to echo" } },
        required: ["text"],
      },
      handler: async (input: unknown) => ({ text: String((input as { text: string }).text) }),
    }],
  })
  const catalog = makeAppCatalog()
  catalog.register({
    ns: "ops",
    appId: "board",
    registry,
    authorize: () => true,
    ui: {
      doc: () => ({ kind: "document", view: "board" }),
      state: () => ({ greeting: "hi", open: true }),
    },
  })
  const entry = catalog.find("ops", "board")
  if (entry === undefined) throw new Error("test entry not registered")
  return entry
}

test("fromCatalogEntry yields exactly the registry tool set (parity: no extra)", () => {
  const view = fromCatalogEntry(makeEntry())
  expect(view.ns).toBe("ops")
  expect(view.appId).toBe("board")
  expect(view.state).toEqual({ greeting: "hi", open: true })
  expect(view.actions).toHaveLength(1)
  expect(view.actions[0]?.name).toBe("echo")
  expect(view.actions[0]?.inputSchema).toEqual({
    type: "object",
    properties: { text: { type: "string", description: "text to echo" } },
    required: ["text"],
  })
})

test("interactiveSpec shows a form field from the tool inputSchema + state as text", () => {
  const spec = interactiveSpec(fromCatalogEntry(makeEntry()))
  expect(spec).toContain('data-ns="ops"')
  expect(spec).toContain('data-action="echo"')
  expect(spec).toContain('name="text"')
  expect(spec).toContain("&quot;greeting&quot;: &quot;hi&quot;")
})

test("submitAction accepts a real agent action and rejects unknown ones", () => {
  const view = fromCatalogEntry(makeEntry())
  expect(submitAction(view, "echo", { text: "hello" })).toEqual({ name: "echo", args: { text: "hello" } })
  expect(() => submitAction(view, "sudo", {})).toThrow("not an agent action")
})

test("parityFromSnapshot reconstructs an interactive view with the frozen state", () => {
  const view = fromCatalogEntry(makeEntry())
  const frozen = Object.freeze({ greeting: "hi", open: true })
  const snapshot: ObservationSnapshot = {
    id: "snap-1",
    capturedAt: 42,
    data: {
      ns: "ops",
      appId: "board",
      view: { kind: "document", view: "board" },
      state: frozen,
      actions: view.actions,
    },
  }
  const replayed = parityFromSnapshot(snapshot)
  expect(replayed.state).toBe(frozen)
  expect(replayed.ns).toBe("ops")
  expect(replayed.actions).toHaveLength(1)
  expect(interactiveSpec(replayed)).toContain('data-action="echo"')
})
