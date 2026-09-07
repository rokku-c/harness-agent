import { expect, test } from "bun:test"
import { makeAiGateway, type GatewayEvent } from "../src/index.ts"

test("injects matching controls, proxies, and emits auditable events", async () => {
  const events: GatewayEvent[] = []
  let upstreamBody: unknown
  const gateway = makeAiGateway({
    rules: [{ ruleId: "safe-agent", match: { agent: "coder" }, inject: { content: "Do not expose secrets." } }],
    recorder: { record: (event) => { events.push(event) } },
    upstream: { send: async (request) => { upstreamBody = await request.json(); return Response.json({ ok: true }) } }
  })
  const request = new Request("http://gateway/v1/chat/completions", { method: "POST", headers: { authorization: "Bearer secret" }, body: JSON.stringify({ model: "m", messages: [{ role: "user", content: "Hi" }] }) })
  const response = await gateway.handle(request, { requestId: "r1", agent: "coder", path: "/v1/chat/completions" })
  expect(response.status).toBe(200)
  expect((upstreamBody as { messages: Array<{ content: string }> }).messages[0]?.content).toBe("Do not expose secrets.")
  expect(events.map((item) => item.type)).toEqual(["request", "injection", "response"])
  expect(JSON.stringify(events)).not.toContain("Bearer secret")
})

test("does not inject a rule for another agent", async () => {
  let count = 0
  const gateway = makeAiGateway({ rules: [{ ruleId: "only-a", match: { agent: "a" }, inject: { content: "control" } }], upstream: { send: async (request) => { count = ((await request.json()) as { messages: unknown[] }).messages.length; return Response.json({}) } } })
  await gateway.handle(new Request("http://gateway/v1/chat/completions", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }) }), { requestId: "r2", agent: "b", path: "/v1/chat/completions" })
  expect(count).toBe(1)
})
