import { expect, test } from "bun:test"
import { fetchDataSource, makeUIDataStore, syncDataSource } from "../src/index.ts"

test("syncs an asynchronous data source into runtime state", async () => {
  const store = makeUIDataStore({ old: true })
  const sync = syncDataSource(store, { read: async () => ({ user: { name: "Ada" } }) })
  expect(await sync.refresh()).toEqual({ old: true, user: { name: "Ada" } })
})

test("fetches an object data source and rejects invalid responses", async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({ count: 2 }), { status: 200 })) as typeof fetch
  try { expect(await fetchDataSource("https://data.test").read()).toEqual({ count: 2 }) }
  finally { globalThis.fetch = original }
})
