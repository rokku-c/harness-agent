import { expect, test } from "bun:test"

import { viewToJsonSchema, viewToJsonSpec, type EffectUiView } from "../src/index.ts"

const valueOf = (element: { props: Record<string, unknown> }, key: string): unknown => element.props[key]

test("text node with bind projects value as { $bindState } instead of the static string", () => {
  const view: EffectUiView = { viewId: "bind-text", nodes: [{ kind: "text", text: "static", bind: "/title" }] }
  const spec = viewToJsonSpec(view)
  const textEl = Object.values(spec.elements).find((element) => element.type === "Text")
  expect(textEl).toBeDefined()
  expect(valueOf(textEl!, "value")).toEqual({ $bindState: "/title" })
})

test("formField with bind renders Input value as { $bindState }", () => {
  const view: EffectUiView = {
    viewId: "bind-form",
    nodes: [{ kind: "formField", label: "Name", value: "old", bind: "/form/name" }],
  }
  const spec = viewToJsonSpec(view)
  const inputEl = Object.values(spec.elements).find((element) => element.type === "Input")
  expect(inputEl).toBeDefined()
  expect(valueOf(inputEl!, "label")).toBe("Name")
  expect(valueOf(inputEl!, "value")).toEqual({ $bindState: "/form/name" })
})

test("nodes without bind keep static string props (regression)", () => {
  const view: EffectUiView = {
    viewId: "bind-static",
    nodes: [
      { kind: "text", text: "hi" },
      { kind: "button", label: "Go", onPress: "go" },
      { kind: "formField", label: "Name", value: "Ada" },
      { kind: "formField", label: "Empty" },
    ],
  }
  const spec = viewToJsonSpec(view)
  const leaf = Object.values(spec.elements).filter((element) => element.type !== "Stack")
  const text = leaf.find((element) => element.type === "Text")!
  const button = leaf.find((element) => element.type === "Button")!
  const inputs = leaf.filter((element) => element.type === "Input")
  expect(valueOf(text, "value")).toBe("hi")
  expect(valueOf(button, "label")).toBe("Go")
  expect(valueOf(inputs[0], "value")).toBe("Ada")
  expect("value" in inputs[1].props).toBe(false)
})

test("viewToJsonSchema keeps bind optional on text/button/formField and excludes it from required", () => {
  const schema = viewToJsonSchema() as unknown as {
    $defs?: Record<string, { oneOf?: Array<{ properties: Record<string, unknown>; required?: string[] }> }>
  }
  const union = Object.values(schema.$defs ?? {}).find((def) => def.oneOf !== undefined)
  const byKind = new Map<string, { properties: Record<string, unknown>; required?: string[] }>()
  for (const member of union?.oneOf ?? []) {
    byKind.set((member.properties.kind as { const: string }).const, member)
  }
  for (const kind of ["text", "button", "formField"]) {
    const member = byKind.get(kind)
    expect(member?.properties.bind).toEqual({ type: "string" })
    expect(member?.required?.includes("bind")).toBe(false)
  }
})
