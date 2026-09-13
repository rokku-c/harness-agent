import { expect, test } from "bun:test"

import {
  contractToTokenized,
  makeRenderContract,
  type EffectUiView,
} from "../src/index.ts"

const view: EffectUiView = {
  viewId: "d",
  nodes: [
    { component: "Text", bind: "/a" },
    { component: "Text", bind: "/a" },
    { component: "Flex", repeat: { source: { state: "/work" } }, children: [{ component: "Text", item: "title" }] },
    { component: "Button", props: { value: "Board view" }, onPress: "board_view" },
  ],
}
const actions = [{ name: "board_view", description: "kanban" }]

test("tokenized projection symbolizes repeated values and marks collapse rules", () => {
  const contract = makeRenderContract(view, actions)
  expect(contract.rules.collapsibleIds).toContain("2") // the repeating collection is collapsible

  const tokens = contractToTokenized(contract, { a: "shared/very/long/ref" })
  expect(tokens).toContain("value=@s0") // repeated long value interned
  expect(tokens).toContain("symbols:")
  expect(tokens).toContain("exclusive=true")
  expect(tokens).toContain("expandOn=click")
  expect(tokens).toContain("[click:board_view]")
})
