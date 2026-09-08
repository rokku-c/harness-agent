import { expect, test } from "bun:test"
import { withDeck } from "./helpers.ts"

test("launcher CRUD keeps raw config and deduplicates kind/label", () => withDeck(async app => {
  const launcher = { kind: "custom", label: "带配置", config: { cwd: "/tmp", env: { DECK_X: "1" } } }
  await app.post("/api/launchers", launcher)
  await app.post("/api/launchers", launcher)
  expect((await app.get("/api/launchers")).launchers).toEqual([launcher])
  expect((await app.get("/api/deck")).launchers).toEqual([launcher])
  const removed = await app.request("/api/launchers/" + encodeURIComponent(launcher.label) + "?kind=custom", undefined, "DELETE")
  expect(await removed.json()).toEqual({ ok: true, removed: launcher })
  expect((await app.get("/api/launchers")).launchers).toEqual([])
  expect((await app.request("/api/launchers/nope", undefined, "DELETE")).status).toBe(404)
  expect((await app.request("/api/launchers", { kind: "" })).status).toBe(400)
}))

test("config preview maps raw config and exposes parseable samples", () => withDeck(async app => {
  const raw = { model: "claude-sonnet-4-5", cwd: "/w", permissionMode: "bypassPermissions", allowedTools: ["Read"] }
  const preview = await app.get("/api/config/preview?kind=claude-code&raw=" + encodeURIComponent(JSON.stringify(raw)))
  expect(preview.unified).toMatchObject({ kind: "claude-code", model: raw.model, cwd: "/w", consent: { autoApproveTools: ["Read"] } })
  expect(preview.invocation.file).toBe("claude")
  expect(preview.invocation.argv).toContain("<prompt>")
  expect((await app.request("/api/config/preview?raw=%7B")).status).toBe(400)
  const { samples } = await app.get("/api/config/samples")
  expect(Object.keys(samples).sort()).toEqual(["claude-code", "claude-cc", "codex", "gemini", "pi", "demo", "custom", "effect", "effect-ops"].sort())
  expect(JSON.parse(samples["effect-ops"]).consent.defaultDecision).toBe("ask")
}))
