import { expect, test } from "bun:test"

import { advertisedName, makeToolCatalog } from "../src/index.ts"

test("a server's tools are advertised under one flat name each", () => {
  const catalog = makeToolCatalog()
  catalog.replace("effect-board", [{ name: "board_view", description: "View the board" }])
  catalog.replace("files", [{ name: "read" }])
  expect(catalog.list().map((entry) => entry.advertised)).toEqual(["effect-board.board_view", "files.read"])
  expect(catalog.find("effect-board.board_view")).toMatchObject({ serverId: "effect-board", tool: "board_view", description: "View the board" })
})

test("characters outside the advertised alphabet are folded, not dropped", () => {
  expect(advertisedName("ops/svc", "get:item")).toBe("ops_svc.get_item")
  expect(advertisedName("effect-board", "board_view")).toBe("effect-board.board_view")
})

test("a name is a key, never parsed back into its parts", () => {
  const catalog = makeToolCatalog()
  catalog.replace("a", [{ name: "b.c" }])
  catalog.replace("a.b", [{ name: "c" }])
  expect(catalog.list().map((entry) => entry.advertised)).toEqual(["a.b_c", "a_b.c"])
  expect(catalog.find("a.b_c")).toMatchObject({ serverId: "a", tool: "b.c" })
  expect(catalog.find("a_b.c")).toMatchObject({ serverId: "a.b", tool: "c" })
})

test("two servers whose ids fold together cannot both keep the same name", () => {
  const catalog = makeToolCatalog()
  catalog.replace("a b", [{ name: "view" }])
  catalog.replace("a_b", [{ name: "else" }])
  expect(() => catalog.replace("a_b", [{ name: "view" }])).toThrow()
  expect(catalog.find("a_b.view")).toMatchObject({ serverId: "a b" })
  expect(catalog.find("a_b.else")).toMatchObject({ serverId: "a_b" })
})

test("one server advertising the same name twice is refused", () => {
  const catalog = makeToolCatalog()
  expect(() => catalog.replace("board", [{ name: "view" }, { name: "view" }])).toThrow()
  expect(catalog.list()).toEqual([])
})

test("replacing a server swaps its tools and leaves the others alone", () => {
  const catalog = makeToolCatalog()
  catalog.replace("board", [{ name: "view" }, { name: "create" }])
  catalog.replace("files", [{ name: "read" }])
  catalog.replace("board", [{ name: "create" }])
  expect(catalog.list().map((entry) => entry.advertised)).toEqual(["board.create", "files.read"])
  expect(catalog.find("board.view")).toBeUndefined()
})

test("forgetting a server frees its names for another server", () => {
  const catalog = makeToolCatalog()
  catalog.replace("board", [{ name: "view" }])
  catalog.forget("board")
  expect(catalog.list()).toEqual([])
  expect(() => catalog.replace("successor", [{ name: "view" }])).not.toThrow()
  expect(catalog.find("successor.view")).toBeDefined()
})
