import { expect, test } from "bun:test"
import { makeMcpGateway, type McpGatewayEvent, type McpGatewayRule, type McpUpstream } from "../src/index.ts"

const resolver = { resolve: async ({ serverId }: { serverId?: string }) => serverId ? { serverId, era: "modern" } : undefined }
const upstream: McpUpstream = { call: async () => ({ status: 200, ok: true, detail: "ok", durationMs: 12 }) }
function make(rules: McpGatewayRule[] = [], extra: object = {}, source = upstream) {
  const events: McpGatewayEvent[] = []
  const gateway = makeMcpGateway({ rules, resolver, recorder: { record: (event) => void events.push(event) }, upstream: source, ...extra })
  return { events, gateway }
}

test("allows an unguarded call and audits call/response", async () => {
  const { events, gateway } = make()
  const result = await gateway.handle({ callId: "rf-1", agent: "builder-2", serverId: "effect-board", tool: "board_start" })
  expect(result).toMatchObject({ ok: true, status: 200, serverId: "effect-board", decision: "allow" })
  expect(events.map((event) => event.type)).toEqual(["call", "response"])
})

test("denies a matching rule without calling upstream", async () => {
  let called = false
  const source: McpUpstream = { call: async () => { called = true; return { status: 200, ok: true, durationMs: 0 } } }
  const { events, gateway } = make([{ ruleId: "cost-guard", match: { serverId: "ext-files", tool: "fs_write" }, action: "deny" }], {}, source)
  const result = await gateway.handle({ callId: "rf-2", agent: "triage-1", serverId: "ext-files", tool: "fs_write" })
  expect(result).toMatchObject({ ok: false, status: 403, decision: "deny", ruleId: "cost-guard" })
  expect(called).toBe(false)
  expect(events.map((event) => event.type)).toEqual(["call", "rule", "error"])
})

test("log rule annotates but forwards", async () => {
  const { events, gateway } = make([{ ruleId: "audit", match: { session: "s1" }, action: "log" }])
  const result = await gateway.handle({ callId: "rf-3", session: "s1", serverId: "effect-board", tool: "board_view" })
  expect(result).toMatchObject({ ok: true, decision: "log", ruleId: "audit" })
  expect(events[1]).toMatchObject({ type: "rule", decision: "log" })
})

test("returns 404 when no server resolves", async () => {
  const { events, gateway } = make()
  const result = await gateway.handle({ callId: "rf-4", tool: "ghost_tool" })
  expect(result).toMatchObject({ ok: false, status: 404, decision: "deny", detail: "no_server" })
  expect(events).toHaveLength(1)
})

test("default deny blocks unmatched calls", async () => {
  const { events, gateway } = make([], { defaultAction: "deny" })
  const result = await gateway.handle({ callId: "rf-5", serverId: "effect-board", tool: "board_view" })
  expect(result).toMatchObject({ ok: false, status: 403, decision: "deny" })
  expect(events.map((event) => event.type)).toEqual(["call", "error"])
})
