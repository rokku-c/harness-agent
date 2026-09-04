/**
 * deckconsole product e2e (no model/bins): boot the real HTTP server with the
 * built-in demo agent and drive open -> send -> consent ask -> approve ->
 * mapping + config preview + close through its REST API.
 */
import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { Effect } from "effect"
import { startDeckServer } from "../src/main.ts"

let base = ""
let stop: (() => void) | undefined

beforeAll(async () => {
  const { server, base: b } = startDeckServer({ launchers: [{ kind: "demo", label: "演示评审" }] })
  base = b
  stop = () => server.stop(true)
})
afterAll(() => { stop?.() })

const get = async (path: string): Promise<any> => {
  const r = await fetch(base + path)
  return r.json()
}
const opsModelFactory = (): import("@effect-agent/builtin").Model => {
  const model: any = {
    generate: (_s: string, messages: ReadonlyArray<any>) =>
      Effect.gen(function* () {
        const toolMsgs = [...messages].reverse().filter((m: any) => m.role === "tool")
        if (toolMsgs.length > 0) return { text: "op-result:" + JSON.stringify((toolMsgs[0] as any).content) }
        const user = [...messages].reverse().find((m: any) => m.role === "user")
        const content = String((user as any)?.content ?? "write /tmp/x")
        const path = content.trim().split(/\s+/).pop() ?? "/tmp/x"
        return { toolCalls: [{ id: "w1", name: "write_file", input: { path } }] }
      })
  }
  return model as import("@effect-agent/builtin").Model
}

const post = async (path: string, body: unknown): Promise<any> => {
  const r = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  return r.json()
}

describe("deckconsole control room", () => {
  test("the management page is served", async () => {
    const r = await fetch(base + "/")
    expect(r.status).toBe(200)
    const text = await r.text()
    expect(text).toContain("agentdeck")
  })

  test("demo session: open -> send -> ask -> approve shows in the consent map", async () => {
    const opened = await post("/api/session", { kind: "demo", sessionId: "demo-1", config: { label: "评审" } })
    expect(opened.ok).toBe(true)
    const first = await post("/api/session/demo-1/send", { text: "hi" })
    expect(first.ok && first.text).toBe("demo:评审 <- hi")
    const asking = await post("/api/session/demo-1/send", { text: "ask:read {\"path\":\"/tmp/x\"}" })
    expect(asking.ok).toBe(true)
    const deck1 = await get("/api/deck")
    expect(deck1.pending.length).toBe(1)
    expect(deck1.pending[0].sessionId).toBe("demo-1")
    expect(deck1.pending[0].tool).toBe("read")
    expect(deck1.sessions.some((s: any) => s.sessionId === "demo-1")).toBe(true)
    const callId = deck1.pending[0].callId
    const ok = await post("/api/consent/" + callId, { allow: true })
    expect(ok.ok && ok.allow).toBe(true)
    const deck2 = await get("/api/deck")
    expect(deck2.pending.length).toBe(0)
    const row = deck2.mapping.find((x: any) => x.sessionId === "demo-1")
    expect(row?.allowed).toBe(1)
    // close clears the session
    await post("/api/session/demo-1/close", {})
    const deck3 = await get("/api/deck")
    expect(deck3.sessions.some((s: any) => s.sessionId === "demo-1")).toBe(false)
  })

  test("launcher CRUD persists to the config file across restarts", async () => {
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const { mkdtempSync, rmSync, readFileSync } = await import("node:fs")
    const dir = mkdtempSync(join(tmpdir(), "deck-"))
    const file = join(dir, "deck.json")
    try {
      const first = startDeckServer({ configFile: file })
      const j1 = await fetch(first.base + "/api/launchers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "custom", label: "巡检员" }) }).then((r) => r.json())
      expect(j1.ok).toBe(true)
      expect(j1.launchers.some((l: any) => l.label === "巡检员")).toBe(true)
      first.server.stop(true)
      const disk = JSON.parse(readFileSync(file, "utf-8"))
      expect(disk.launchers.some((l: any) => l.label === "巡检员")).toBe(true)
      const second = startDeckServer({ configFile: file })
      const d2 = await fetch(second.base + "/api/deck").then((r) => r.json())
      expect(d2.launchers.some((l: any) => l.label === "巡检员")).toBe(true)
      const del = await fetch(second.base + "/api/launchers/" + encodeURIComponent("巡检员") + "?kind=custom", { method: "DELETE" }).then((r) => r.json())
      expect(del.ok).toBe(true)
      second.server.stop(true)
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })

  test("launchers, consent history and config samples are exposed", async () => {
    const d = await get("/api/deck")
    expect(d.launchers.length).toBeGreaterThan(0)
    expect(d.launchers[0].label.length).toBeGreaterThan(0)
    expect(d.samples["claude-code"]).toContain("permissionMode")
    const hist = await get("/api/consent")
    expect(Array.isArray(hist.entries)).toBe(true)
  })

  test("config preview maps a claude-code raw config to the unified shape", async () => {
    const raw = JSON.stringify({ model: "claude-sonnet-4-5", cwd: "/w", permissionMode: "bypassPermissions", allowedTools: ["Read"] })
    const j = await get("/api/config/preview?kind=claude-code&raw=" + encodeURIComponent(raw))
    expect(j.ok).toBe(true)
    expect(j.unified.kind).toBe("claude-code")
    expect(j.unified.model).toBe("claude-sonnet-4-5")
    expect(j.unified.extra.permissionMode).toBe("bypassPermissions")
    expect(j.unified.consent.autoApproveTools).toEqual(["Read"])
  })

  test("session consent policy auto-settles asks from the unified config", async () => {
    const opened = await post("/api/session", {
      kind: "demo", sessionId: "demo-auto",
      config: { label: "自动", consent: { autoApproveTools: ["note_write"], defaultDecision: "deny" } }
    })
    expect(opened.ok).toBe(true)
    // auto-approved tool never stays pending; recorded allow by auto
    await post("/api/session/demo-auto/send", { text: 'ask:note_write {"text":"x"}' })
    const deck1 = await get("/api/deck")
    expect(deck1.pending.length).toBe(0)
    const row = deck1.mapping.find((x: any) => x.sessionId === "demo-auto")
    expect(row?.allowed).toBe(1)
    const hist = await get("/api/session/demo-auto/history")
    const entry = hist.consent.find((e: any) => e.tool === "note_write")
    expect(entry?.decision).toBe("allow")
    expect(entry?.by).toBe("auto")
    // defaultDecision deny settles OTHER tools as deny by auto
    await post("/api/session/demo-auto/send", { text: 'ask:edit_file {"path":"/x"}' })
    const deck2 = await get("/api/deck")
    expect(deck2.pending.length).toBe(0)
    expect(deck2.mapping.find((x: any) => x.sessionId === "demo-auto")?.denied).toBe(1)
    await post("/api/session/demo-auto/close", {})
  })


  test("close-all terminates every open session", async () => {
    await post("/api/session", { kind: "demo", sessionId: "c-1", config: { label: "一" } })
    await post("/api/session", { kind: "demo", sessionId: "c-2", config: { label: "二" } })
    const d0 = await get("/api/deck")
    expect(d0.sessions.length).toBeGreaterThanOrEqual(2)
    const res = await post("/api/sessions/close-all", {})
    expect(res.ok && res.closed).toBeGreaterThanOrEqual(2)
    const d1 = await get("/api/deck")
    expect(d1.sessions.some((s: any) => s.sessionId === "c-1" || s.sessionId === "c-2")).toBe(false)
  })


  test("bulk approve settles every pending ask at once", async () => {
    await post("/api/session", { kind: "demo", sessionId: "b-1", config: { label: "批1" } })
    await post("/api/session", { kind: "demo", sessionId: "b-2", config: { label: "批2" } })
    await post("/api/session/b-1/send", { text: 'ask:read {"path":"/a"}' })
    await post("/api/session/b-2/send", { text: 'ask:write {"path":"/b"}' })
    const d0 = await get("/api/deck")
    expect(d0.pending.length).toBeGreaterThanOrEqual(2)
    const bulk = await post("/api/consent/bulk", { allow: true })
    expect(bulk.ok && bulk.decided).toBeGreaterThanOrEqual(2)
    const d1 = await get("/api/deck")
    expect(d1.pending.length).toBe(0)
    await post("/api/sessions/close-all", {})
  })

})

describe("deckconsole effect-ops loop (approval steers execution through the product)", () => {
  let opsBase = ""
  let opsStop: (() => void) | undefined
  beforeAll(async () => {
    const { server, base } = startDeckServer({ effectModel: opsModelFactory })
    opsBase = base
    opsStop = () => server.stop(true)
  })
  afterAll(() => { opsStop?.() })
  const get2 = async (path: string): Promise<any> => (await fetch(opsBase + path)).json()
  const post2 = async (path: string, body: unknown): Promise<any> => {
    const r = await fetch(opsBase + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    return r.json()
  }

  test("write op: send -> pending in flow -> approve -> resend executes", async () => {
    const opened = await post2("/api/session", { kind: "effect-ops", sessionId: "eo-api", config: { model: "scripted" } })
    expect(opened.ok).toBe(true)
    const first = await post2("/api/session/eo-api/send", { text: "please write /tmp/from-product.txt" })
    expect(first.ok).toBe(false)
    expect(first.awaiting?.length).toBe(1)
    const d1 = await get2("/api/deck")
    expect(d1.pending.some((p: any) => p.callId === first.awaiting[0])).toBe(true)
    const approved = await post2("/api/consent/" + first.awaiting[0], { allow: true })
    expect(approved.ok).toBe(true)
    const second = await post2("/api/session/eo-api/send", { text: "please write /tmp/from-product.txt" })
    expect(second.ok).toBe(true)
    expect(second.text).toContain("op-result")
    await post2("/api/session/eo-api/close", {})
  })

  test("retry re-sends the awaiting turn after approval (no repaste needed)", async () => {
    const opened = await post2("/api/session", { kind: "effect-ops", sessionId: "retry-1", config: { model: "scripted" } })
    expect(opened.ok).toBe(true)
    const first = await post2("/api/session/retry-1/send", { text: "please write /tmp/retry.txt" })
    expect(first.ok).toBe(false)
    expect(first.awaiting?.length).toBe(1)
    const approved = await post2("/api/consent/" + first.awaiting[0], { allow: true })
    expect(approved.ok).toBe(true)
    const retried = await post2("/api/session/retry-1/retry", {})
    expect(retried.ok).toBe(true)
    expect(retried.retried).toBe(true)
    await post2("/api/session/retry-1/close", {})
  })
})

describe("deckconsole dynamic cli presets (register a new agent dialect at runtime)", () => {
  test("POST /api/presets then open/send the new kind through its preset argv", async () => {
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const { mkdtempSync, writeFileSync, chmodSync, rmSync } = await import("node:fs")
    const dir = mkdtempSync(join(tmpdir(), "deck-claw-"))
    const script = join(dir, "clawlike.sh")
    writeFileSync(script, "#!/bin/sh\necho CLAW-RESPONSE:$1\n")
    chmodSync(script, 0o755)
    try {
      const reg = await post("/api/presets", { kind: "clawlike", file: "sh", args: [script] })
      expect(reg.ok).toBe(true)
      const list = await get("/api/presets")
      expect(list.presets.some((p: any) => p.kind === "clawlike" && p.builtin === false)).toBe(true)
      const opened = await post("/api/session", { kind: "clawlike", sessionId: "claw-1", config: { label: "新方言" } })
      expect(opened.ok).toBe(true)
      const out = await post("/api/session/claw-1/send", { text: "hello claw" })
      expect(out.ok).toBe(true)
      expect(out.text).toBe("CLAW-RESPONSE:hello claw")
      // config preview also sees the dynamic dialect as invocable
      const raw = encodeURIComponent(JSON.stringify({}))
      const preview = await get("/api/config/preview?kind=clawlike&raw=" + raw)
      expect(preview.ok).toBe(true)
      expect(preview.invocation?.file).toBe("sh")
      await post("/api/session/claw-1/close", {})
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })


  test("opening a session with an already-open id returns 409", async () => {
    const a = await post("/api/session", { kind: "demo", sessionId: "dup-1", config: { label: "一" } })
    expect(a.ok).toBe(true)
    const b = await fetch(base + "/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "demo", sessionId: "dup-1", config: { label: "二" } }) })
    expect(b.status).toBe(409)
    const dup = await b.json()
    expect(dup.detail).toContain("already open")
    await post("/api/session/dup-1/close", {})
  })



  test("concurrent send to a running session is rejected with 409 busy", async () => {
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const { mkdtempSync, writeFileSync, chmodSync, rmSync } = await import("node:fs")
    const dir = mkdtempSync(join(tmpdir(), "deck-busy-"))
    const script = join(dir, "slow.sh")
    writeFileSync(script, "#!/bin/sh\nsleep 1.2\necho DONE-BUSY\n")
    chmodSync(script, 0o755)
    try {
      const opened = await post("/api/session", { kind: "custom", sessionId: "busy-1", config: { label: "忙", command: "sh", args: [script] } })
      expect(opened.ok).toBe(true)
      const first = fetch(base + "/api/session/busy-1/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "go" }) })
      await new Promise((r) => setTimeout(r, 250))
      const second = await fetch(base + "/api/session/busy-1/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "again" }) })
      expect(second.status).toBe(409)
      const busy = await second.json()
      expect(busy.detail).toContain("busy")
      const done = await (await first).json()
      expect(done.ok).toBe(true)
      expect(done.text).toBe("DONE-BUSY")
      await post("/api/session/busy-1/close", {})
    } finally { rmSync(dir, { recursive: true, force: true }) }
  })





  test("launcher carries raw config and opens sessions from it", async () => {
    const added = await post("/api/launchers", { kind: "custom", label: "带配置", config: { cwd: "/tmp", env: { DECK_X: "1" } } })
    expect(added.ok).toBe(true)
    const list = await get("/api/launchers")
    const launcher = list.launchers.find((l: any) => l.label === "带配置")
    expect(launcher.config.cwd).toBe("/tmp")
    expect(launcher.config.env.DECK_X).toBe("1")
    const opened = await post("/api/session", { kind: "custom", sessionId: "cfg-l", config: { label: "带配置", cwd: "/tmp", env: { DECK_X: "1" }, command: "true" } })
    expect(opened.ok).toBe(true)
    await post("/api/session/cfg-l/close", {})
    await fetch(base + "/api/launchers/" + encodeURIComponent("带配置") + "?kind=" + encodeURIComponent("custom"), { method: "DELETE" })
  })


  test("config samples cover every known kind incl effect-ops/demo/claude-cc", async () => {
    const samples = await get("/api/config/samples")
    const keys = Object.keys(samples.samples ?? samples ?? {})
    const expected = ["effect", "effect-ops", "claude-code", "claude-cc", "codex", "gemini", "pi", "demo", "custom"]
    for (const k of expected) expect(keys).toContain(k)
    expect(samples.samples?.["effect-ops"] ?? samples["effect-ops"]).toContain("defaultDecision")
  })


  test("opening an unknown never-registered kind returns 404 with guidance", async () => {
    const res = await fetch(base + "/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "totally-unknown", sessionId: "x-1", config: {} }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.detail).toContain("register a preset")
  })

})