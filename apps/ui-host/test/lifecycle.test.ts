import { Database } from "bun:sqlite"
import { expect, spyOn, test } from "bun:test"
import { makeWebHandler } from "../src/web.ts"
import { startWebHost } from "../src/standalone.ts"
import { makeActivityStore } from "../src/activity.ts"

test("activity and handler close SQLite once and reject use after close", async () => {
  const close = spyOn(Database.prototype, "close")
  try {
    const activity = makeActivityStore(":memory:")
    activity.close(); activity.close()
    expect(() => activity.list()).toThrow()
    const app = makeWebHandler({ databaseFile: ":memory:" })
    app.close(); app.close()
    expect((await app.handle(new Request("http://ui/api/activity"))).status).toBe(503)
    // the standalone activity store plus the handler's activity and canvas stores
    expect(close).toHaveBeenCalledTimes(3)
  } finally { close.mockRestore() }
})

test("standalone binds its explicit port and releases SQLite together with the listener", async () => {
  const close = spyOn(Database.prototype, "close")
  const app = startWebHost({ host: "127.0.0.1", port: 0, databaseFile: ":memory:", theme: "dusk" })
  try {
    const response = await fetch(new URL("/api/runtime", app.server.url))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ theme: "dusk" })
    await app.close(); await app.close()
    // both durable stores (activity, canvas) close with the listener
    expect(close).toHaveBeenCalledTimes(2)
    await expect(fetch(app.server.url)).rejects.toThrow()
  } finally { await app.close(); close.mockRestore() }
})

test("standalone bind failure closes its allocated SQLite", () => {
  const close = spyOn(Database.prototype, "close")
  const serve = spyOn(Bun, "serve").mockImplementation(() => { throw new Error("bind failed") })
  try {
    expect(() => startWebHost({ databaseFile: ":memory:" })).toThrow("bind failed")
    expect(close).toHaveBeenCalledTimes(2)
  } finally { serve.mockRestore(); close.mockRestore() }
})
