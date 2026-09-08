import { expect, test } from "bun:test"
import { fixture } from "./helpers.ts"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("dynamic presets drive only this app's CLI gateway and preview", async () => {
  const dir = mkdtempSync(join(tmpdir(), "deck-preset-")), script = join(dir, "echo.sh")
  writeFileSync(script, '#!/bin/sh\necho CLAW-RESPONSE:$1\n')
  const app = fixture(), other = fixture()
  try {
    expect(await app.post("/api/presets", { kind: "clawlike", file: "sh", args: [script] }))
      .toEqual({ ok: true, kind: "clawlike", file: "sh", args: [script] })
    expect((await app.get("/api/presets")).presets.find((p: any) => p.kind === "clawlike"))
      .toEqual({ kind: "clawlike", file: "sh", args: [script], builtin: false })
    expect((await other.request("/api/session", { kind: "clawlike" })).status).toBe(404)
    await app.post("/api/session", { kind: "clawlike", sessionId: "claw" })
    expect(await app.post("/api/session/claw/send", { text: "hello" })).toEqual({ ok: true, text: "CLAW-RESPONSE:hello" })
    expect((await app.get("/api/config/preview?kind=clawlike")).invocation.file).toBe("sh")
    expect((await app.request("/api/presets", { kind: "demo", file: "sh" })).status).toBe(409)
    expect((await app.request("/api/presets", { kind: "" })).status).toBe(400)
  } finally { await app.close(); await other.close(); rmSync(dir, { recursive: true, force: true }) }
})

test("a concurrent send is rejected while the gateway is running", async () => {
  const app = fixture()
  let finish!: () => void
  const waiting = new Promise<void>(resolve => { finish = resolve })
  let running = false
  app.deck.register({
    kind: "custom",
    open: async () => ({ sessionId: "busy", kind: "custom", status: "idle" }),
    status: async () => ({ sessionId: "busy", kind: "custom", status: running ? "running" : "idle" }),
    sessions: () => [{ sessionId: "busy", kind: "custom", status: running ? "running" : "idle", openedAt: 0, lastActivityAt: 0 }],
    send: async () => { running = true; await waiting; running = false; return { ok: true, text: "done" } },
    close: async () => {},
  })
  try {
    const first = app.post("/api/session/busy/send", { text: "first" })
    for (let i = 0; i < 20 && !running; i++) await Bun.sleep(1)
    expect(running).toBe(true)
    expect((await app.request("/api/session/busy/send", { text: "second" })).status).toBe(409)
    finish()
    expect(await first).toEqual({ ok: true, text: "done" })
  } finally { finish(); await app.close() }
})
