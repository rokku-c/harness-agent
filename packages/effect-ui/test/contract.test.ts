import { expect, test } from "bun:test"

import {
  contractToCompact,
  contractToJson,
  contractToToml,
  makeRenderContract,
  type EffectUiView,
} from "../src/index.ts"

const view: EffectUiView = {
  viewId: "d",
  nodes: [
    { component: "Text", bind: "/title" },
    { component: "Button", props: { value: "Open board" }, onPress: "board_view" },
    { component: "TextField.Root", bind: "/currentView" },
  ],
}

const actions = [{ name: "board_view", description: "kanban", inputSchema: { type: "object" } }]

test("makeRenderContract attaches rules: component, data binding, interactive markers", () => {
  const c = makeRenderContract(view, actions)
  expect(c.lang).toBe("contract")
  const button = c.elements.find((e) => e.component === "Button")
  expect(button?.interactive).toEqual([{ on: "click", action: "board_view", args: {} }])
  const text = c.elements.find((e) => e.component === "Text")
  expect(text?.data).toBe("/title")
  expect(text?.display).toBe(true)
})

test("projections carry interactions in every representation (json / toml / compact)", () => {
  const c = makeRenderContract(view, actions)
  const data = { title: "Hello", currentView: "board" }

  const asJson = contractToJson(c, data)
  expect(asJson).toContain('"interactive"')

  const asToml = contractToToml(c, data)
  expect(asToml).toContain('component = "Button"')
  expect(asToml).toContain("action = \"board_view\"")

  const asCompact = contractToCompact(c, data)
  expect(asCompact).toContain("[click:board_view]")
  expect(asCompact).toContain("value=\"Hello\"") // data resolved into the text
  expect(asCompact).toContain("actions: board_view")
})

test("renders even with zero data (empty-data rule is part of the contract)", () => {
  const c = makeRenderContract(view, actions)
  const compact = contractToCompact(c, undefined)
  expect(compact).toContain("Button")
  expect(compact).toContain("empty-data rule")
  const json = contractToJson(c, undefined)
  expect(json).toContain("emptyDataRule")
})
