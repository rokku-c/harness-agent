import { expect, test } from "bun:test"
import { makeDefinitionStore } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { jsonReactRenderer } from "../src/index.ts"

test("renders a canvas through the official json-render React runtime", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  runtime.apply({ kind: "create-canvas", canvasId: "root", title: "Root" })
  runtime.apply({ kind: "insert-node", canvasId: "root", node: { id: "hello", type: "Text", props: { value: "Hello" } } })
  expect(jsonReactRenderer.render(runtime.view())).toContain("Hello")
})
