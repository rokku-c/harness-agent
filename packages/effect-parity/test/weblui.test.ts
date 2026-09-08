import { expect, test } from "bun:test"

import { interactivePage, type ParityAppView } from "../src/index.ts"

const view: ParityAppView = {
  ns: "ops",
  appId: "board",
  view: { viewId: "board", nodes: [] },
  state: { items: 3 },
  actions: [{ name: "board_state", description: "snapshot", inputSchema: { type: "object", properties: {} } }],
}

test("weblui renders lui interactively: forms equal agent tools and submit to the same url", () => {
  const page = interactivePage(view, {
    submitUrl: "/-/mirror/ops::board/call",
    richHtml: '<img alt="live" src="/board.png">',
  })
  expect(page).toContain("weblui · ops::board")
  expect(page).toContain("data-action=\"board_state\"")
  expect(page).toContain("/-/mirror/ops::board/call")
  expect(page).toContain('src="/board.png"') // media shown directly
  expect(page).toContain("what the agent sees")
})

test("weblui omits the direct-view section when no rich html is given", () => {
  const page = interactivePage(view, { submitUrl: "/-/mirror/call" })
  expect(page).not.toContain("direct view (media / animation)")
})
