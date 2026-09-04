import { expect, test } from "bun:test"
import { makeDefinitionStore } from "@effect-agent/ui-definition"
import { resolveCanvas } from "../src/index.ts"
import { makeActions } from "../src/index.ts"
import { makeUIRuntime } from "../src/index.ts"
import { makeUIJournal, restoreUIRuntime } from "../src/index.ts"
import { join } from "node:path"
import { tmpdir } from "node:os"

test("resolves bound props and nested canvas", () => {
  const store = makeDefinitionStore()
  store.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  store.apply({ kind: "create-canvas", canvasId: "child", title: "Child" })
  store.apply({ kind: "insert-node", canvasId: "child", node: { id: "value", type: "Text", bindings: { value: { kind: "path", value: "$.user.name" } } } })
  store.apply({ kind: "insert-node", canvasId: "root", node: { id: "ref", type: "CanvasRef", props: { targetCanvasId: "child" } } })
  const tree = resolveCanvas(store, "root", { user: { name: "Ada" } })
  expect(tree.children[0]!.resolvedChildren[0]!.resolvedProps.value).toBe("Ada")
})

test("resolves safe path and template bindings", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "text", type: "Text", bindings: {
    value: { kind: "template", value: "Hello {{user.name}} ($.user.id)" }
  } } })
  expect(runtime.view({ user: { name: "Ada", id: 7 } }).children[0]!.resolvedProps.value).toBe("Hello Ada (7)")
})

test("exposes parent scope inside a nested canvas", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  runtime.apply({ kind: "create-canvas", canvasId: "child", title: "Child" })
  runtime.apply({ kind: "insert-node", canvasId: "child", node: { id: "parent-value", type: "Text", bindings: { value: { kind: "path", value: "$parent.user.name" } } } })
  runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "ref", type: "CanvasRef", props: { targetCanvasId: "child" } } })
  expect(runtime.view({ user: { name: "Ada" } }).children[0]!.resolvedChildren[0]!.resolvedProps.value).toBe("Ada")
})

test("navigates into nested canvas and back", async () => {
  const actions = makeActions("root")
  await actions.dispatch({ eventId: "e1", nodeId: "ref", type: "click", actions: [{ action: "navigate_to_canvas", input: { canvasId: "child", userId: "u1" } }] })
  expect(actions.navigation()).toEqual({ current: "child", stack: ["root"], params: { userId: "u1" } })
  await actions.dispatch({ eventId: "e2", nodeId: "child", type: "click", actions: [{ action: "go_back" }] })
  expect(actions.navigation()).toEqual({ current: "root", stack: [], params: {} })
})

test("restores parent parameters after nested navigation", async () => {
  const actions = makeActions("root")
  await actions.dispatch({ eventId: "e1", nodeId: "a", type: "click", actions: [{ action: "navigate_to_canvas", input: { canvasId: "a", rootId: "r" } }] })
  await actions.dispatch({ eventId: "e2", nodeId: "b", type: "click", actions: [{ action: "navigate_to_canvas", input: { canvasId: "b", childId: "c" } }] })
  await actions.dispatch({ eventId: "e3", nodeId: "b", type: "click", actions: [{ action: "go_back" }] })
  expect(actions.navigation().params).toEqual({ rootId: "r" })
})

test("keeps parent data available after navigation", async () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  runtime.apply({ kind: "create-canvas", canvasId: "child", title: "Child" })
  runtime.apply({ kind: "insert-node", canvasId: "child", node: { id: "text", type: "Text", bindings: { value: { kind: "path", value: "$parent.user" } } } })
  await runtime.dispatch({ eventId: "e", nodeId: "ref", type: "click", actions: [{ action: "navigate_to_canvas", input: { canvasId: "child" } }] })
  expect(runtime.view({ user: "Ada" }).children[0]!.resolvedProps.value).toBe("Ada")
})

test("routes definition changes and view through one runtime", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "text", type: "Text", props: { value: "ok" } } })
  expect(runtime.view().children[0]!.resolvedProps.value).toBe("ok")
})

test("switches theme without changing the canvas definition", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  const version = runtime.version("root")
  runtime.setTheme("hand-drawn")
  expect(runtime.theme()).toBe("hand-drawn")
  expect(runtime.version("root")).toBe(version)
})

test("records only successfully applied commands", () => {
  const store = makeDefinitionStore()
  const recorded: string[] = []
  const runtime = makeUIRuntime(store, "root", { onCommand: (command) => recorded.push(command.kind) })
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  expect(() => runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Again" })).toThrow()
  expect(recorded).toEqual(["create-canvas"])
})

test("replays a JSONL command journal", async () => {
  const file = join(tmpdir(), `ui-journal-${crypto.randomUUID()}`, "state", "ui.jsonl")
  const journal = makeUIJournal(file)
  await journal.append({ kind: "create-canvas", canvasId: "root", title: "Restored" })
  await journal.append({ kind: "set-theme", theme: "dark" })
  await journal.append({ kind: "set-renderer", renderer: "canvas" })
  const runtime = makeUIRuntime(makeDefinitionStore(), "root")
  expect(await journal.replay(runtime)).toBe(3)
  expect(runtime.view().title).toBe("Restored")
  expect(runtime.theme()).toBe("dark")
  expect(runtime.renderer()).toBe("canvas")
})

test("restore does not duplicate history and records new commands", async () => {
  const file = join(tmpdir(), `ui-restore-${crypto.randomUUID()}`, "ui.jsonl")
  const journal = makeUIJournal(file)
  await journal.append({ kind: "create-canvas", canvasId: "root", title: "Root" })
  const runtime = await restoreUIRuntime(makeDefinitionStore(), "root", file)
  runtime.apply({ kind: "set-theme", theme: "dark" })
  await new Promise((resolve) => setTimeout(resolve, 10))
  expect((await makeUIJournal(file).read()).map((command) => command.kind)).toEqual(["create-canvas", "set-theme"])
})

test("expands a registered composite component", () => {
  const store = makeDefinitionStore()
  store.registerComponent({ type: "Card", version: "1", category: "composite", template: { id: "body", type: "Text", props: { value: "inside" } } })
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "card", type: "Card" } })
  expect(runtime.view().children[0]!.resolvedChildren[0]!.resolvedProps.value).toBe("inside")
})

test("passes composite instance props into its template", () => {
  const store = makeDefinitionStore()
  store.registerComponent({ type: "Label", version: "1", category: "composite", template: { id: "label", type: "Text", bindings: { value: { kind: "path", value: "$.props.title" } } } })
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "label", type: "Label", props: { title: "Dynamic" } } })
  expect(runtime.view().children[0]!.resolvedChildren[0]!.resolvedProps.value).toBe("Dynamic")
})

test("injects named slot children into a composite", () => {
  const store = makeDefinitionStore()
  store.registerComponent({ type: "Panel", version: "1", category: "composite", slots: ["content"], template: { id: "content-slot", type: "Slot", slot: "content" } })
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "child", type: "Text", props: { value: "slot value" } } })
  runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "panel", type: "Panel", slots: { content: ["child"] } } })
  expect(runtime.view().children[1]!.resolvedChildren[0]!.resolvedProps.value).toBe("slot value")
})
