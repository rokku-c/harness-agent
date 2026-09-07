import { expect, test } from "bun:test"
import { makeDefinitionStore } from "@effect-agent/ui-definition"
import { toJsonRenderSpec } from "../src/index.ts"

test("adapts canvas nodes, bindings, actions and links to json-render Spec", () => {
  const store = makeDefinitionStore()
  store.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  store.apply({ kind: "create-canvas", canvasId: "detail", title: "Detail" })
  store.apply({ kind: "insert-node", canvasId: "root", node: { id: "name", type: "Text",
    bindings: { value: { kind: "path", value: "$.user.name" } },
    events: { click: [{ action: "set_data", input: { path: "$.selected", value: true } }] } } })
  store.apply({ kind: "link-canvas", canvasId: "root", nodeId: "detail", targetCanvasId: "detail" })
  const spec = toJsonRenderSpec(store.getCanvas("root")!)
  expect(spec.elements.name?.props.value).toEqual({ $state: "/user/name" })
  expect(spec.elements.name?.on?.click).toEqual([{ action: "set_data", params: { path: "$.selected", value: true } }])
  expect(spec.elements.detail?.props.targetCanvasId).toBe("detail")
})
