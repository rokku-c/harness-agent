import { expect, test } from "bun:test"
import { makeUIDataStore, syncDataSource } from "../src/index.ts"

test("syncs an asynchronous data source into runtime state", async () => {
  const store = makeUIDataStore({ old: true })
  const sync = syncDataSource(store, { read: async () => ({ user: { name: "Ada" } }) })
  expect(await sync.refresh()).toEqual({ old: true, user: { name: "Ada" } })
})
