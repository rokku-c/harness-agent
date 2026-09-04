import { describe, expect, test } from "bun:test"
import { makeDefinitionStore, registerBuiltins } from "../src/index.ts"
import { UIError } from "@effect-agent/ui-protocol"

describe("ui definition store", () => {
  test("composes nodes inside a canvas", () => {
    const store = registerBuiltins(makeDefinitionStore())
    store.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
    const canvas = store.apply({ kind: "insert-node", canvasId: "root", node: { id: "stack", type: "Stack" } })!
    store.apply({ kind: "insert-node", canvasId: "root", parentId: "stack", node: { id: "label", type: "Text", props: { value: "hello" } } })
    expect(canvas.rootNodeIds).toEqual(["stack"])
    expect(store.getCanvas("root")!.nodes.stack!.children).toEqual(["label"])
  })

  test("rejects stale patches", () => {
    const store = registerBuiltins(makeDefinitionStore())
    store.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
    store.apply({ kind: "insert-node", canvasId: "root", node: { id: "text", type: "Text" } })
    expect(() => store.apply({ kind: "patch-node", canvasId: "root", nodeId: "text", props: { value: "x" }, expectedVersion: 1 })).toThrow(UIError)
  })

  test("rejects invalid composite declarations", () => {
    const store = makeDefinitionStore()
    expect(() => store.registerComponent({ type: "Loop", version: "1", category: "composite", template: { id: "loop", type: "Loop" } })).toThrow("recursive")
    expect(() => store.registerComponent({ type: "Panel", version: "1", category: "composite", template: { id: "slot", type: "Slot", slot: "body" } })).toThrow("undeclared slot")
  })

  test("registers the built-in building blocks", () => {
    const store = registerBuiltins(makeDefinitionStore())
    expect(store.listComponents().map((item) => item.type)).toContain("CanvasRef")
    expect(store.listComponents()).toHaveLength(6)
  })

  test("validates built-in node constraints", () => {
    const store = registerBuiltins(makeDefinitionStore())
    store.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
    expect(() => store.apply({ kind: "insert-node", canvasId: "root", node: { id: "bad", type: "Text", children: ["x"] } })).toThrow("cannot contain")
    expect(() => store.apply({ kind: "insert-node", canvasId: "root", node: { id: "ref", type: "CanvasRef" } })).toThrow("targetCanvasId")
    expect(() => store.apply({ kind: "insert-node", canvasId: "root", node: { id: "slot", type: "Slot" } })).toThrow("nested")
  })

  test("rejects stale component versions", () => {
    const store = registerBuiltins(makeDefinitionStore())
    store.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
    expect(() => store.apply({ kind: "insert-node", canvasId: "root", node: { id: "text", type: "Text", version: "0" } })).toThrow("version is stale")
  })

  test("removes leaf nodes and preserves tree invariants", () => {
    const store = makeDefinitionStore()
    store.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
    store.apply({ kind: "insert-node", canvasId: "root", node: { id: "stack", type: "Stack" } })
    store.apply({ kind: "insert-node", canvasId: "root", parentId: "stack", node: { id: "text", type: "Text" } })
    store.apply({ kind: "remove-node", canvasId: "root", nodeId: "text" })
    expect(store.getCanvas("root")!.nodes.stack!.children).toEqual([])
    expect(() => store.apply({ kind: "remove-node", canvasId: "root", nodeId: "stack" })).not.toThrow()
  })

  test("links an existing canvas with a navigable reference", () => {
    const store = registerBuiltins(makeDefinitionStore())
    store.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
    store.apply({ kind: "create-canvas", canvasId: "child", title: "Child" })
    store.apply({ kind: "link-canvas", canvasId: "root", nodeId: "child-link", targetCanvasId: "child" })
    const link = store.getCanvas("root")!.nodes["child-link"]!
    expect(link.props?.targetCanvasId).toBe("child")
    expect(link.events?.click?.[0]).toEqual({ action: "navigate_to_canvas", input: { canvasId: "child" } })
  })
})
