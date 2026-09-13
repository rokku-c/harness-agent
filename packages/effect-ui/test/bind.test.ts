import { expect, test } from "bun:test"

import { viewToJsonSchema, viewToJsonSpec, type EffectUiView } from "../src/index.ts"

const valueOf = (element: { props: Record<string, unknown> }, key: string): unknown => element.props[key]

test("a bound node writes the binding into the prop it named, not the literal it was given", () => {
  const view: EffectUiView = {
    viewId: "bind-text",
    nodes: [
      { component: "Text", props: { value: "static" }, bind: "/title" },
      { component: "TextField.Root", props: { placeholder: "Name", value: "old" }, bind: "/form/name" },
    ],
  }
  const spec = viewToJsonSpec(view)
  const text = Object.values(spec.elements).find((element) => element.type === "Text")
  const field = Object.values(spec.elements).find((element) => element.type === "TextField.Root")
  expect(text).toBeDefined()
  expect(valueOf(text!, "value")).toEqual({ $bindState: "/title" })
  expect(valueOf(field!, "placeholder")).toBe("Name")
  expect(valueOf(field!, "value")).toEqual({ $bindState: "/form/name" })
})

test("nodes without a live value keep every static prop untouched (regression)", () => {
  const view: EffectUiView = {
    viewId: "bind-static",
    nodes: [
      { component: "Text", props: { value: "hi" } },
      { component: "Button", props: { value: "Go", variant: "soft" }, onPress: "go" },
      { component: "TextField.Root", props: { value: "Ada" } },
    ],
  }
  const spec = viewToJsonSpec(view)
  const text = Object.values(spec.elements).find((element) => element.type === "Text")!
  const button = Object.values(spec.elements).find((element) => element.type === "Button")!
  const field = Object.values(spec.elements).find((element) => element.type === "TextField.Root")!
  expect(valueOf(text, "value")).toBe("hi")
  expect(button.props).toEqual({ value: "Go", variant: "soft" })
  expect(valueOf(field, "value")).toBe("Ada")
})

test("the exported schema keeps every directive optional: a static document is still a document", () => {
  const schema = viewToJsonSchema() as unknown as { properties: { nodes: { items?: Record<string, unknown> } } }
  const exported = JSON.stringify(schema)
  for (const directive of ["bind", "item", "repeat", "visible", "onPress"]) expect(exported).toContain(`"${directive}"`)
  const staticView: EffectUiView = { viewId: "s", nodes: [{ component: "Text", props: { value: "hello" } }] }
  expect(viewToJsonSpec(staticView).elements["0"].props).toEqual({ value: "hello" })
})
