import { expect, test } from "bun:test"
import { fixture, opsModelFactory, withDeck } from "./helpers.ts"

for (const retry of [false, true]) test(`approval resumes a pending turn via ${retry ? "retry" : "send"}`, () => withDeck(async app => {
  await app.post("/api/session", { kind: "effect-ops", sessionId: "ops", config: { model: "scripted" } })
  const text = "please write /tmp/deck-test.txt"
  const first = await app.post("/api/session/ops/send", { text })
  expect(first.ok).toBe(false)
  expect(first.awaiting).toHaveLength(1)
  expect((await app.get("/api/deck")).pending[0].callId).toBe(first.awaiting[0])
  await app.post("/api/consent/" + first.awaiting[0], { allow: true })
  const second = await app.post(`/api/session/ops/${retry ? "retry" : "send"}`, retry ? {} : { text })
  expect(second.ok).toBe(true)
  if (retry) expect(second.retried).toBe(true)
  expect((await app.request("/api/session/ops/retry", {})).status).toBe(404)
  expect((await app.get("/api/session/ops/history")).consent[0].decision).toBe("allow")
}, { effectModel: opsModelFactory }))

test("retry state is per-instance and is removed when a session closes", async () => {
  const first = fixture({ effectModel: opsModelFactory }), second = fixture({ effectModel: opsModelFactory })
  try {
    for (const app of [first, second]) await app.post("/api/session", { kind: "effect-ops", sessionId: "same" })
    await first.post("/api/session/same/send", { text: "write /tmp/a" })
    expect((await second.request("/api/session/same/retry", {})).status).toBe(404)
    await first.post("/api/session/same/close", {})
    await first.post("/api/session", { kind: "effect-ops", sessionId: "same" })
    expect((await first.request("/api/session/same/retry", {})).status).toBe(404)
  } finally { await first.close(); await second.close() }
})
