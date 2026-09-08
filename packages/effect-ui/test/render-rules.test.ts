import { expect, test } from "bun:test"

import {
  contractToTokenized,
  defaultRefreshMode,
  makeRenderContract,
  warnPartialWithoutBase,
  type EffectUiView,
} from "../src/index.ts"

const view: EffectUiView = {
  viewId: "d",
  nodes: [
    { kind: "text", text: "A", bind: "/a" },
    { kind: "text", text: "B", bind: "/a" },
    { kind: "list", items: ["live work items", "resources & executors", "consent asks"] },
    { kind: "button", label: "Board view", onPress: "board_view" },
  ],
}
const actions = [{ name: "board_view", description: "kanban" }]

test("tokenized projection symbolizes repeated values and marks collapse rules", () => {
  const contract = makeRenderContract(view, actions)
  expect(contract.rules.collapsibleIds).toContain("2") // the List is collapsible
  expect(contract.refresh.default).toBe("partial")

  const tokens = contractToTokenized(contract, { a: "shared/very/long/ref" })
  expect(tokens).toContain("value=@s0") // repeated long value interned
  expect(tokens).toContain("symbols:")
  expect(tokens).toContain("exclusive=true")
  expect(tokens).toContain("expandOn=click")
  expect(tokens).toContain("[click:board_view]")
})

test("partial refresh warns when the base frame may be out of context", () => {
  const warn = warnPartialWithoutBase(["card"], false)
  expect(warn).toContain("base frame")
  expect(warn).toContain("card")
  expect(warnPartialWithoutBase([], false)).toBeNull()
  expect(warnPartialWithoutBase(["card"], true)).toBeNull()
  expect(defaultRefreshMode(makeRenderContract(view, actions))).toBe("partial")
})
