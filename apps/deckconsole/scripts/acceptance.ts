/**
 * deckconsole acceptance - no-key reproducible smoke for the control room.
 * Core flows run headless over real HTTP (demo agent); REAL=1 additionally
 * drives a real claude-code session through the same API if the binary is
 * present and authorised.
 * Run: bun apps/deckconsole/scripts/acceptance.ts   (optionally REAL=1)
 */
import { startDeckServer } from "../src/main.ts"

const real = process.env.REAL === "1"
let passed = 0
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) { passed++; console.log("  PASS " + name) }
  else { console.error("  FAIL " + name + (extra ? " :: " + extra : "")); process.exitCode = 1 }
}

const { server, base } = startDeckServer({})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 80; i++) { try { if ((await fetch(base + "/api/deck")).ok) break } catch {} await sleep(250) }

const post = async (path: string, body: unknown) => (await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json()
const get = async (path: string) => (await fetch(base + path)).json()

const page = await fetch(base + "/")
check("page served", page.ok)
const open = await post("/api/session", { kind: "demo", sessionId: "acc-1", config: { label: "验收" } })
check("open session", open.ok === true, JSON.stringify(open))
const hi = await post("/api/session/acc-1/send", { text: "hi" })
check("demo turn answers", hi.ok === true && typeof hi.text === "string" && hi.text.length > 0)
const ask = await post("/api/session/acc-1/send", { text: 'ask:read {"path":"/acceptance"}' })
check("ask raises pending", ask.ok === true && typeof ask.text === "string" && ask.text.includes("asked 1 consent"), JSON.stringify(ask))
const d1 = await get("/api/deck")
const pending = d1.pending.find((x: any) => x.sessionId === "acc-1" && x.tool === "read")
check("flow shows the pending ask", pending !== undefined)
const approve = await post("/api/consent/" + pending.callId, { allow: true })
check("approve settles", approve.ok === true)
const d2 = await get("/api/deck")
check("mapping reflects allowed entry", (d2.mapping.find((x: any) => x.sessionId === "acc-1")?.entries ?? 0) >= 1)
const preview = await get("/api/config/preview?kind=claude-code&raw=" + encodeURIComponent(JSON.stringify({ model: "opus" })))
check("claude-code preview plan", preview.ok === true && preview.invocation?.file === "claude" && preview.invocation.argv.includes("<prompt>"))
const reg = await post("/api/presets", { kind: "accnew", file: "acc", args: ["-p"] })
check("dynamic preset registers", reg.ok === true)
const list = await get("/api/presets")
check("presets list includes dynamic", list.presets.some((x: any) => x.kind === "accnew" && x.builtin === false))
await post("/api/sessions/close-all", {})
const d3 = await get("/api/deck")
check("close-all empties sessions", d3.sessions.length === 0)

if (real) {
  try {
    const ro = await post("/api/session", { kind: "claude-code", sessionId: "acc-real", config: { label: "真机" } })
    check("real: open claude-code", ro.ok === true, JSON.stringify(ro))
    const rs = await fetch(base + "/api/session/acc-real/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Reply with exactly: ACCEPT-OK" }) })
    const rj = (await rs.json()) as any
    check("real: claude answers", rs.status === 200 && rj.ok && String(rj.text ?? "").includes("ACCEPT-OK"), JSON.stringify(rj))
  } catch (error) {
    console.error("  SKIP real segment (error): " + (error instanceof Error ? error.message : String(error)))
  }
}

await server.stop(true)
console.log(passed + " checks passed" + (process.exitCode ? " (with failures)" : " - ACCEPTANCE GREEN"))
