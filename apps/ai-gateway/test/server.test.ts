import { expect, test } from "bun:test"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { startAiGateway, typeOrmRecorder } from "../src/main.ts"

test("proxies OpenAI-compatible requests with controlled injection and audit", async () => {
  let received: { messages: Array<{ content: string }> } | undefined
  let leakedAgent: string | null = null
  const upstream = Bun.serve({ port: 0, fetch: async (request) => { leakedAgent = request.headers.get("x-agent-id"); received = await request.json() as typeof received; return Response.json({ choices: [] }) } })
  const recorder = typeOrmRecorder(join(tmpdir(), `ai-gateway-${crypto.randomUUID()}.sqlite`))
  const gateway = startAiGateway({ port: 0, upstreamBase: upstream.url.toString(), database: ":memory:", recorder, rules: [{ ruleId: "coder-control", match: { agent: "coder" }, inject: { content: "Stay in scope." } }] })
  try {
    const response = await fetch(new URL("/v1/chat/completions", gateway.url), { method: "POST", headers: { "content-type": "application/json", "x-agent-id": "coder" }, body: JSON.stringify({ model: "test", messages: [{ role: "user", content: "work" }] }) })
    expect(response.status).toBe(200)
    expect(received?.messages[0]?.content).toBe("Stay in scope.")
    expect(leakedAgent).toBeNull()
    const audit = JSON.stringify(await recorder.events())
    expect(audit).toContain('"ruleId":"coder-control"')
    expect(audit).toContain('"contentDigest"')
    expect(audit).not.toContain("authorization")
  } finally { gateway.stop(true); upstream.stop(true); await recorder.close() }
})

test("exposes health without contacting the upstream", async () => {
  const gateway = startAiGateway({ port: 0, upstreamBase: "http://127.0.0.1:1", database: ":memory:" })
  try { expect(await (await fetch(new URL("/health", gateway.url))).json()).toEqual({ ok: true }) }
  finally { gateway.stop(true) }
})
