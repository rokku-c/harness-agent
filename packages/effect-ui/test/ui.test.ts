import { expect, test } from "bun:test"

import { defineUi, type EffectUiView } from "../src/index.ts"

// the app developer writes ONLY what to show + data + actions:
const view: EffectUiView = {
  viewId: "orders",
  title: "Orders",
  nodes: [
    { component: "Text", bind: "/orderId" },
    { component: "Button", props: { value: "Ship" }, onPress: "order_ship" },
  ],
}

test("developer authors only view+actions; everything else is derived", () => {
  const ui = defineUi({
    view,
    actions: [{ name: "order_ship", description: "mark shipped", inputSchema: { type: "object", properties: {} } }],
    data: { orderId: "ORD-123" },
  })

  // no developer-authored contracts anywhere — all derived
  expect(ui.contract.lang).toBe("contract")
  expect(ui.contract.actions.map((a) => a.name)).toEqual(["order_ship"])
  const ship = ui.contract.elements.find((e) => e.component === "Button")
  expect(ship?.interactive).toEqual([{ on: "click", action: "order_ship", args: {} }])

  const out = ui.project()
  expect(out.json).toContain('"lang": "contract"')
  expect(out.compact).toContain("[click:order_ship]")
  expect(out.toml).toContain("action = \"order_ship\"")
  expect(out.token).toContain("actions: order_ship")
  expect(out.token).toContain("value=\"ORD-123\"")
})
