import { Database } from "bun:sqlite"
import { expect, spyOn, test } from "bun:test"
import { createDeckApp } from "../src/app.ts"
import { startDeckServer } from "../src/standalone.ts"
import { fixture } from "./helpers.ts"

test("handler close terminates sessions, closes SQLite once and rejects subsequent requests", async () => {
  const close = spyOn(Database.prototype, "close"), app = fixture()
  try {
    await app.post("/api/session", { sessionId: "owned" })
    await app.close(); await app.close()
    expect(app.deck.sessions()).toEqual([])
    expect(close).toHaveBeenCalledTimes(1)
    expect((await app.request("/api/deck")).status).toBe(503)
  } finally { await app.close(); close.mockRestore() }
})

test("a failing session disposer cannot prevent SQLite or other sessions from closing", async () => {
  const close = spyOn(Database.prototype, "close"), app = fixture()
  try {
    await app.post("/api/session", { sessionId: "good" })
    const gateway = app.deck.get("demo")!, original = gateway.close
    const stop = spyOn(gateway, "close").mockImplementation(async id => {
      await original(id)
      throw new Error("session stop failed")
    })
    await expect(app.close()).rejects.toThrow("Failed to close deck sessions")
    expect(stop).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
    expect(app.deck.sessions()).toEqual([])
  } finally { await app.close().catch(() => {}); close.mockRestore() }
})

test("standalone listener serves HTTP and closes its own database", async () => {
  const close = spyOn(Database.prototype, "close")
  const app = startDeckServer({ host: "127.0.0.1", port: 0, configFile: ":memory:" })
  try {
    const response = await fetch(app.base + "/api/deck")
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ kinds: ["demo"], sessions: [], pending: [] })
    await app.close(); await app.close()
    expect(close).toHaveBeenCalledTimes(1)
    await expect(fetch(app.base)).rejects.toThrow()
  } finally { await app.close(); close.mockRestore() }
})

test("a standalone bind failure still closes the allocated database", async () => {
  const close = spyOn(Database.prototype, "close")
  const serve = spyOn(Bun, "serve").mockImplementation(() => { throw new Error("bind failed") })
  try {
    expect(() => startDeckServer({ configFile: ":memory:" })).toThrow("bind failed")
    await Bun.sleep(0)
    expect(close).toHaveBeenCalledTimes(1)
  } finally { serve.mockRestore(); close.mockRestore() }
})

test("embedded launchers do not read DECK_AGENTS environment providers", async () => {
  const previous = process.env.DECK_AGENTS
  process.env.DECK_AGENTS = JSON.stringify([{ kind: "demo", label: "env-only" }])
  const app = createDeckApp({ configFile: ":memory:" })
  try {
    const response = await app.handle(new Request("http://deck/api/launchers"))
    expect(await response.json()).toEqual({ ok: true, launchers: [] })
  } finally {
    await app.close()
    if (previous === undefined) delete process.env.DECK_AGENTS
    else process.env.DECK_AGENTS = previous
  }
})
