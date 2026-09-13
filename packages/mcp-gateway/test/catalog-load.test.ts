import { expect, test } from "bun:test"

import { loadToolCatalog, makeToolCatalog, type CatalogTool, type McpToolLister } from "../src/index.ts"

const lister = (tools: Record<string, readonly CatalogTool[]>): McpToolLister => ({
  list: async ({ serverId }) => {
    const found = tools[serverId]
    if (found === undefined) throw new Error(`unreachable: ${serverId}`)
    return found
  },
})

test("every reachable server is loaded and reported", async () => {
  const catalog = makeToolCatalog()
  const report = await loadToolCatalog(catalog, lister({ board: [{ name: "view" }], files: [{ name: "read" }] }), [{ serverId: "board" }, { serverId: "files" }])
  expect(report).toEqual({ loaded: ["board", "files"], failed: [] })
  expect(catalog.list().map((entry) => entry.advertised)).toEqual(["board.view", "files.read"])
})

test("one unreachable server does not stop the others, and is named", async () => {
  const catalog = makeToolCatalog()
  const report = await loadToolCatalog(catalog, lister({ files: [{ name: "read" }] }), [{ serverId: "ghost" }, { serverId: "files" }])
  expect(report.loaded).toEqual(["files"])
  expect(report.failed).toEqual([{ serverId: "ghost", detail: "unreachable: ghost" }])
  expect(catalog.find("files.read")).toBeDefined()
})

test("a server that fails to list keeps the tools it last advertised", async () => {
  const catalog = makeToolCatalog()
  await loadToolCatalog(catalog, lister({ board: [{ name: "view" }] }), [{ serverId: "board" }])
  const report = await loadToolCatalog(catalog, lister({}), [{ serverId: "board" }])
  expect(report.loaded).toEqual([])
  expect(catalog.find("board.view")).toBeDefined()
})

test("a reload replaces the surface it had before", async () => {
  const catalog = makeToolCatalog()
  await loadToolCatalog(catalog, lister({ board: [{ name: "view" }, { name: "create" }] }), [{ serverId: "board" }])
  await loadToolCatalog(catalog, lister({ board: [{ name: "create" }] }), [{ serverId: "board" }])
  expect(catalog.list().map((entry) => entry.tool)).toEqual(["create"])
})
