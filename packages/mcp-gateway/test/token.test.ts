import { expect, test } from "bun:test"

import { hashToken, makeTokenStore } from "../src/index.ts"

const withClock = (start = 1_000) => {
  let at = start
  const store = makeTokenStore({ now: () => at })
  return { store, advance: (ms: number) => { at += ms } }
}

test("an issued token verifies to the principal it was issued for", () => {
  const { store } = withClock()
  const { token } = store.issue({ principalKey: "user:alice" })
  expect(store.verify(token)?.principalKey).toBe("user:alice")
})

test("the store keeps a digest, never the token itself", () => {
  const { store } = withClock()
  const { token } = store.issue({ principalKey: "user:alice" })
  const stored = store.list()[0]!
  expect(stored.tokenHash).toBe(hashToken(token))
  expect(Object.values(stored)).not.toContain(token)
})

test("two issues yield distinct tokens for the same principal", () => {
  const { store } = withClock()
  const first = store.issue({ principalKey: "user:alice" })
  const second = store.issue({ principalKey: "user:alice" })
  expect(first.token).not.toBe(second.token)
  expect(store.list()).toHaveLength(2)
})

test("unknown and malformed tokens do not verify", () => {
  const { store } = withClock()
  store.issue({ principalKey: "user:alice" })
  expect(store.verify("t_forged")).toBeUndefined()
  expect(store.verify("")).toBeUndefined()
})

test("a token stops verifying once its lifetime has passed", () => {
  const { store, advance } = withClock()
  const { token } = store.issue({ principalKey: "app:sync", ttlMs: 500 })
  expect(store.verify(token)).toBeDefined()
  advance(499)
  expect(store.verify(token)).toBeDefined()
  advance(1)
  expect(store.verify(token)).toBeUndefined()
})

test("revocation happens once and outlives further verification", () => {
  const { store } = withClock()
  const { token } = store.issue({ principalKey: "user:alice" })
  expect(store.revoke(token)).toBe(true)
  expect(store.revoke(token)).toBe(false)
  expect(store.verify(token)).toBeUndefined()
  expect(store.revoke("t_never-issued")).toBe(false)
})

test("verification records when the token was last used", () => {
  const { store, advance } = withClock()
  const { token } = store.issue({ principalKey: "user:alice" })
  expect(store.list()[0]!.lastUsedAt).toBeUndefined()
  advance(250)
  expect(store.verify(token)?.lastUsedAt).toBe(1_250)
})
