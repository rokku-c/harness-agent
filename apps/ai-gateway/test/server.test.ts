import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { startAiGateway, typeOrmRecorder } from "../src/main.ts"

test("proxies OpenAI-compatible requests with controlled injection and audit", async () => {
  let received: { messages: Array<{ content: string }> } | undefined
  let leakedAgent: string | null = null
  const upstream = Bun.serve({ port: 0, fetch: async (request) => { leakedAgent = request.headers.get("x-agent-id"); received = await request.json() as typeof received; return Response.json({ choices: [] }) } })
  const dir = mkdtempSync(join(tmpdir(), "ai-gateway-audit-"))
  const recorder = typeOrmRecorder(join(dir, "audit.sqlite"))
  const gateway = startAiGateway({ port: 0, providers: [{ id: "chat", apiType: "openai.chat", baseURL: upstream.url.toString() }], database: ":memory:", recorder, rules: [{ ruleId: "coder-control", match: { agent: "coder" }, inject: { content: "Stay in scope." } }] })
  try {
    const response = await fetch(new URL("/v1/chat/completions", gateway.url), { method: "POST", headers: { "content-type": "application/json", "x-agent-id": "coder" }, body: JSON.stringify({ model: "test", messages: [{ role: "user", content: "work" }] }) })
    expect(response.status).toBe(200)
    expect(received?.messages[0]?.content).toBe("Stay in scope.")
    expect(leakedAgent).toBeNull()
    const audit = await recorder.events()
    expect(audit.map((event) => event.type)).toEqual(["request", "injection", "response"])
    expect(audit[1].detail.ruleId).toBe("coder-control")
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("Stay in scope."))
    expect(audit[1].detail.contentDigest).toBe(Buffer.from(digest).toString("hex"))
    expect(audit[0].detail.headers).not.toHaveProperty("authorization")
  } finally { await gateway.stop(true); await upstream.stop(true); await recorder.close(); rmSync(dir, { recursive: true, force: true }) }
})

test("exposes health without contacting the upstream", async () => {
  const gateway = startAiGateway({ port: 0, database: ":memory:" })
  try { expect(await (await fetch(new URL("/health", gateway.url))).json()).toEqual({ ok: true }) }
  finally { await gateway.stop(true) }
})
