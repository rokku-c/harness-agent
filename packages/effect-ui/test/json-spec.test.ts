import { expect, test } from "bun:test"

import { viewSpecSchema, viewToJsonSpec, type EffectUiView } from "../src/index.ts"

test("a node lowers to its own component, its own props, and its children in order", () => {
  const view: EffectUiView = {
    viewId: "demo",
    title: "Demo",
    nodes: [
      { component: "Heading", props: { value: "hi", size: "6" } },
      { component: "Flex", props: { gap: "2" }, children: [{ component: "Button", props: { value: "Go" }, onPress: "open.x" }] },
    ],
  }
  const spec = viewToJsonSpec(view)
  expect(spec.elements.root.type).toBe("Flex")
  expect(spec.elements.root.children).toEqual(["0", "1"])
  expect(spec.elements["0"]).toEqual({ type: "Heading", props: { value: "hi", size: "6" } })
  expect(spec.elements["1.0"]).toEqual({ type: "Button", props: { value: "Go" }, on: { press: { action: "open.x" } } })
})

test("bind, item and as decide which prop a live value lands in", () => {
  const spec = viewToJsonSpec({
    viewId: "bind",
    nodes: [
      { component: "Text", bind: "/title" },
      { component: "Text", item: "name" },
      { component: "Avatar", item: "icon", as: "src" },
    ],
  })
  expect(spec.elements["0"].props).toEqual({ value: { $bindState: "/title" } })
  expect(spec.elements["1"].props).toEqual({ value: { $item: "name" } })
  expect(spec.elements["2"].props).toEqual({ src: { $item: "icon" } })
})

test("a repeating, conditionally visible collection keeps its own key and condition", () => {
  const view: EffectUiView = {
    viewId: "registry",
    state: { filter: "" },
    sources: [{ id: "servers", url: "/-/registry/servers", state: "/registry/servers", refreshMs: 10000 }],
    actions: [{ name: "withdraw", method: "DELETE", url: "/-/registry", result: "/registry/result", refresh: ["servers"] }],
    nodes: [{
      component: "Table.Body",
      id: "rows",
      repeat: { source: { state: "/registry/servers" }, key: "serverId" },
      visible: { source: { item: "status" }, equals: "healthy" },
      children: [{
        component: "Table.Row",
        children: [
          { component: "Table.Cell", item: "name" },
          { component: "Button", props: { value: "Withdraw" }, onPress: "withdraw", params: { serverId: { item: "serverId" } } },
        ],
      }],
    }],
  }

  expect(viewSpecSchema().safeParse(view).success).toBe(true)
  const spec = viewToJsonSpec(view)
  expect(spec.elements.rows.repeat).toEqual({ statePath: "/registry/servers", key: "serverId" })
  expect(spec.elements.rows.visible).toEqual({ $item: "status", eq: "healthy" })
  // the repeat is on the body, so the row is what multiplies — one row per item,
  // not one row holding every item's cells
  expect(spec.elements["rows.0"].type).toBe("Table.Row")
  expect(spec.elements["rows.0.0"].props).toEqual({ value: { $item: "name" } })
  // the same field on the same item, spelled for the reader each one has: a prop
  // reads the item, an action param resolves the path the repeat scope stands on
  expect(spec.elements["rows.0.1"].on).toEqual({ press: { action: "withdraw", params: { serverId: { $bindItem: "serverId" } } } })
  expect(spec.state).toEqual({ filter: "" })
})

test("a node that names no component is not a view", () => {
  const parse = viewSpecSchema()
  expect(parse.safeParse({ viewId: "bad", nodes: [{}] }).success).toBe(false)
  expect(parse.safeParse({ viewId: "bad", nodes: [{ component: "" }] }).success).toBe(false)
})
