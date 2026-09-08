import { expect, test } from "bun:test"
import { make } from "./fixtures.ts"

test("allows, resolves, and audits an unguarded call", async () => {
  const { events, gateway } = make(), result = await gateway.handle({ callId: "rf-1", agent: "builder-2", serverId: "effect-board", tool: "board_start" })
  expect(result).toMatchObject({ ok: true, status: 200, decision: "allow" })
  expect(events.map((event) => event.type)).toEqual(["call", "response"])
})
test("deny rule prevents upstream and records the reason", async () => {
  let called = false
  const { events, gateway } = make([{ ruleId: "cost", match: { serverId: "files", tool: "write" }, action: "deny" }], { call: async () => { called = true; return { status: 200, ok: true, durationMs: 0 } } })
  const result = await gateway.handle({ callId: "rf-2", serverId: "files", tool: "write" })
  expect(result).toMatchObject({ ok: false, status: 403, ruleId: "cost" }); expect(called).toBe(false); expect(events.at(-1)?.detail).toBe("denied_by_rule")
})
test("log rules pass while default deny blocks unmatching calls", async () => {
  const logged = make([{ ruleId: "audit", match: { session: "s" }, action: "log" }])
  expect((await logged.gateway.handle({ callId: "rf-3", session: "s", serverId: "board", tool: "view" })).decision).toBe("log")
  const denied = make(undefined, undefined, { defaultAction: "deny" })
  expect((await denied.gateway.handle({ callId: "rf-4", serverId: "board", tool: "view" })).status).toBe(403)
})
test("missing target returns 404", async () => {
  const { events, gateway } = make(), result = await gateway.handle({ callId: "rf-5", tool: "ghost" })
  expect(result.status).toBe(404); expect(events).toHaveLength(1)
})
