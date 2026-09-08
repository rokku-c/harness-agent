import { expect, test } from "bun:test"

import { viewToJsonSpec, type EffectUiView } from "../src/index.ts"

const view: EffectUiView = {
  viewId: "demo",
  title: "Demo",
  nodes: [
    { kind: "text", text: "hi" },
    {
      kind: "stack",
      direction: "horizontal",
      children: [{ kind: "button", label: "Go", onPress: "open.x" }, { kind: "formField", label: "name", value: "a" }],
    },
    { kind: "list", items: ["one", "two"] },
  ],
}

test("viewToJsonSpec projects a view to a @json-render Spec (description-first)", () => {
  const spec = viewToJsonSpec(view)
  expect(spec.root).toBe("root")
  const elements = spec.elements
  expect(elements.root.type).toBe("Stack")
  expect((elements.root.children ?? []).length).toBe(3)
  const text = elements[Object.keys(elements).find((k) => k !== "root") as string]
  expect(text).toBeDefined()
  // a button lowers to a Button, and a list lowers to Text items
  const values = Object.values(elements)
  expect(values.some((e) => e.type === "Button" && (e.props as { label: string }).label === "Go")).toBe(true)
  expect(Object.values(elements).some((e) => e.type === "Text" && (e.props as { value: string }).value === "one")).toBe(true)
})
