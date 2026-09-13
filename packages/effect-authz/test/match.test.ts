import { expect, test } from "bun:test"

import { asResource, covers, specificityOf } from "../src/index.ts"

const c = (grant: string, target: string): boolean => covers(asResource(grant), asResource(target))

test("a container grant reaches everything beneath it", () => {
  expect(c("ops", "ops")).toBe(true)
  expect(c("ops", "ops::board")).toBe(true)
  expect(c("ops", "ops::board.view")).toBe(true)
  expect(c("ops::board", "ops::board.view")).toBe(true)
})

test("a deeper grant does not cover a shallower target", () => {
  expect(c("ops::board", "ops")).toBe(false)
  expect(c("ops::board.view", "ops::board")).toBe(false)
})

test("* consumes exactly one segment, which pins the depth", () => {
  expect(c("ops::board.*", "ops::board.view")).toBe(true)
  expect(c("ops::board.*", "ops::board")).toBe(false)
  expect(c("ops::board.*", "ops::board.view.extra")).toBe(false)
})

test("** requires one or more further segments", () => {
  expect(c("ops::**", "ops::board")).toBe(true)
  expect(c("ops::**", "ops::board.view")).toBe(true)
  expect(c("ops::**", "ops")).toBe(false)
})

test("a bare grant is scheme-agnostic; a named scheme is not", () => {
  expect(c("ops", "ui://ops/board/main")).toBe(true)
  expect(c("**", "mcp://github/create_issue")).toBe(true)
  expect(c("ui://ops/board/main", "ui://ops/board/main")).toBe(true)
  expect(c("ui://ops/board/main", "ops::board.main")).toBe(false)
  expect(c("ui://ops/board/main", "store://ops/board/main")).toBe(false)
})

test("non-relations do not cover", () => {
  expect(c("ops::board", "ops::deck")).toBe(false)
  expect(c("ops", "workspace-a::board")).toBe(false)
  expect(c("ops::board.view", "ops::board.edit")).toBe(false)
})

test("specificity counts literals and bottoms out on **", () => {
  expect(specificityOf(asResource("ops"))).toBe(1)
  expect(specificityOf(asResource("ops::board.view"))).toBe(3)
  expect(specificityOf(asResource("ops::board.*"))).toBe(2)
  expect(specificityOf(asResource("ops::**"))).toBe(0)
})
