import { expect, test } from "bun:test"
import { withDeck } from "./helpers.ts"

test("demo session open/send/approve/history/close preserves the consent map", () => withDeck(async app => {
  const opened = await app.post("/api/session", { kind: "demo", sessionId: "demo-1", config: { label: "评审" } })
  expect(opened.ok).toBe(true)
  expect(await app.post("/api/session/demo-1/send", { text: "hi" })).toEqual({ ok: true, text: "demo:评审 <- hi" })
  await app.post("/api/session/demo-1/send", { text: 'ask:read {"path":"/tmp/x"}' })
  const deck = await app.get("/api/deck")
  expect(deck.pending).toHaveLength(1)
  expect(deck.pending[0]).toMatchObject({ sessionId: "demo-1", tool: "read", input: { path: "/tmp/x" } })
  const callId = deck.pending[0].callId
  expect(await app.post("/api/consent/" + callId, { allow: true })).toEqual({ ok: true, allow: true })
  expect((await app.request("/api/consent/" + callId, { allow: true })).status).toBe(404)
  const after = await app.get("/api/deck")
  expect(after.pending).toEqual([])
  expect(after.mapping).toEqual([{ sessionId: "demo-1", entries: 1, pending: 0, allowed: 1, denied: 0 }])
  const history = await app.get("/api/session/demo-1/history")
  expect(history.turns.map((t: any) => t.role)).toEqual(["user", "agent", "user", "agent"])
  expect(history.consent[0]).toMatchObject({ callId, decision: "allow", by: "operator" })
  await app.post("/api/session/demo-1/close", {})
  expect((await app.get("/api/deck")).sessions).toEqual([])
}))

test("session policy applies auto approval and default denial", () => withDeck(async app => {
  await app.post("/api/session", { kind: "demo", sessionId: "auto", config: {
    consent: { autoApproveTools: ["note_write"], defaultDecision: "deny" },
  } })
  await app.post("/api/session/auto/send", { text: 'ask:note_write {"text":"x"}' })
  await app.post("/api/session/auto/send", { text: 'ask:edit_file {"path":"/x"}' })
  const history = await app.get("/api/session/auto/history")
  expect(history.consent.map((c: any) => [c.tool, c.decision, c.by]))
    .toEqual([["edit_file", "deny", "auto"], ["note_write", "allow", "auto"]])
  expect((await app.get("/api/deck")).pending).toEqual([])
}))

test("bulk consent and close-all count exactly the affected records", () => withDeck(async app => {
  for (const sessionId of ["one", "two"]) {
    await app.post("/api/session", { sessionId })
    await app.post(`/api/session/${sessionId}/send`, { text: 'ask:read {"path":"/a"}' })
  }
  expect(await app.post("/api/consent/bulk", { allow: true })).toEqual({ ok: true, decided: 2 })
  expect((await app.get("/api/consent")).entries.map((c: any) => c.decision)).toEqual(["allow", "allow"])
  expect(await app.post("/api/sessions/close-all", {})).toEqual({ ok: true, closed: 2 })
  expect((await app.get("/api/deck")).sessions).toEqual([])
}))

test("unknown kinds, duplicate sessions, unknown sessions and malformed requests fail", () => withDeck(async app => {
  expect((await app.request("/api/session", { kind: "never-registered" })).status).toBe(404)
  expect((await app.request("/api/session", { sessionId: "same" })).status).toBe(200)
  expect((await app.request("/api/session", { sessionId: "same" })).status).toBe(409)
  expect((await app.request("/api/session/missing/send", { text: "hi" })).status).toBe(404)
  expect((await app.request("/api/session/missing/retry", {})).status).toBe(404)
  const bad = await app.handle(new Request("http://deck/api/session", { method: "POST", body: "{" }))
  expect(bad.status).toBe(500)
  expect(await bad.json()).toMatchObject({ ok: false })
}))
