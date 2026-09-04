import { expect, test } from "bun:test"
import { cachedDataSource, fetchDataSource, makeUIDataStore, syncDataSource } from "../src/index.ts"

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

test("reports HTTP and payload shape failures", async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async (_url, init) => {
    if (init?.headers) return new Response("down", { status: 503 })
    return new Response("[]", { status: 200 })
  }) as typeof fetch
  try {
    await expect(fetchDataSource("https://data.test", { headers: { x: "1" } }).read()).rejects.toThrow("503")
    await expect(fetchDataSource("https://data.test").read()).rejects.toThrow("JSON object")
  } finally { globalThis.fetch = original }
})

test("caches data until the TTL expires", async () => {
  let clock = 0; let calls = 0
  const source = cachedDataSource({ read: async () => { calls += 1; return { calls } } }, 10, () => clock)
  expect(await source.read()).toEqual({ calls: 1 }); expect(await source.read()).toEqual({ calls: 1 })
  clock = 11
  expect(await source.read()).toEqual({ calls: 2 }); expect(calls).toBe(2)
})

test("allows immediate cache invalidation", async () => {
  let calls = 0
  const source = cachedDataSource({ read: async () => ({ calls: ++calls }) }, 1000)
  await source.read(); source.invalidate?.();
  expect(await source.read()).toEqual({ calls: 2 })
})
