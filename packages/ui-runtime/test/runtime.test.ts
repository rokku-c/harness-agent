import { expect, test } from "bun:test"
import { makeDefinitionStore } from "@effect-agent/ui-definition"
import { resolveCanvas } from "../src/index.ts"
import { makeActions } from "../src/index.ts"
import { makeUIRuntime } from "../src/index.ts"

test("resolves bound props and nested canvas", () => {
  const store = makeDefinitionStore()
  store.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  store.apply({ kind: "create-canvas", canvasId: "child", title: "Child" })
  store.apply({ kind: "insert-node", canvasId: "child", node: { id: "value", type: "Text", bindings: { value: { kind: "path", value: "$.user.name" } } } })
  store.apply({ kind: "insert-node", canvasId: "root", node: { id: "ref", type: "CanvasRef", props: { targetCanvasId: "child" } } })
  const tree = resolveCanvas(store, "root", { user: { name: "Ada" } })
  expect(tree.children[0]!.resolvedChildren[0]!.resolvedProps.value).toBe("Ada")
})

test("navigates into nested canvas and back", async () => {
  const actions = makeActions("root")
  await actions.dispatch({ eventId: "e1", nodeId: "ref", type: "click", actions: [{ action: "navigate_to_canvas", input: { canvasId: "child" } }] })
  expect(actions.navigation()).toEqual({ current: "child", stack: ["root"] })
  await actions.dispatch({ eventId: "e2", nodeId: "child", type: "click", actions: [{ action: "go_back" }] })
  expect(actions.navigation()).toEqual({ current: "root", stack: [] })
})

test("routes definition changes and view through one runtime", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "text", type: "Text", props: { value: "ok" } } })
  expect(runtime.view().children[0]!.resolvedProps.value).toBe("ok")
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
