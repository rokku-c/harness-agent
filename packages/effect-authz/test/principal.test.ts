import { expect, test } from "bun:test"

import { isPrincipalKind, parsePrincipalKey, principalKey } from "../src/index.ts"

test("a principal key round-trips through its parser", () => {
  for (const principal of [
    { kind: "user", id: "alice" },
    { kind: "app", id: "billing-sync" },
    { kind: "system", id: "codex-sync" },
  ] as const) {
    expect(parsePrincipalKey(principalKey(principal))).toEqual(principal)
  }
})

test("malformed or unknown keys do not parse", () => {
  expect(parsePrincipalKey("")).toBeUndefined()
  expect(parsePrincipalKey("alice")).toBeUndefined()
  expect(parsePrincipalKey(":alice")).toBeUndefined()
  expect(parsePrincipalKey("user:")).toBeUndefined()
  expect(parsePrincipalKey("robot:alice")).toBeUndefined()
})

test("only the three kinds count as kinds", () => {
  expect(isPrincipalKind("user")).toBe(true)
  expect(isPrincipalKind("app")).toBe(true)
  expect(isPrincipalKind("system")).toBe(true)
  expect(isPrincipalKind("robot")).toBe(false)
})

test("a claim running past the separator stays in the id", () => {
  expect(parsePrincipalKey("user:team:alice")).toEqual({ kind: "user", id: "team:alice" })
})
