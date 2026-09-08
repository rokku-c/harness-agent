import { expect, test } from "bun:test"
import { makeMcpGateway, makeMcpSetRegistry, type McpGatewayEvent } from "../src/index.ts"

const server = { serverId: "files", name: "files", era: "modern" }
function registry() {
  const value = makeMcpSetRegistry()
  value.registerServer(server)
  value.registerSet({ setId: "safe", servers: ["files"], allowTools: ["read"], denyTools: ["write"] })
  value.bindAgent({ agentId: "a1", setIds: ["safe"] })
  return value
}

test("set registry resolves bound server and enforces tool policy", () => {
  const value = registry()
  expect(value.resolve("a1", "safe", "read")).toMatchObject({ serverId: "files", allowed: true })
  expect(value.resolve("a1", "safe", "write")).toMatchObject({ serverId: "files", allowed: false })
  expect(value.resolve("other", "safe", "read")).toBeUndefined()
})

test("set registry rejects duplicate and unknown topology", () => {
  const value = makeMcpSetRegistry()
  value.registerServer(server)
  expect(() => value.registerServer(server)).toThrow("duplicate server")
  expect(() => value.registerSet({ setId: "bad", servers: ["missing"] })).toThrow("unknown server")
  value.registerSet({ setId: "safe", servers: ["files"] })
  expect(() => value.registerSet({ setId: "safe", servers: ["files"] })).toThrow("duplicate set")
  expect(() => value.bindAgent({ agentId: "a1", setIds: ["missing"] })).toThrow("unknown set")
  expect(() => value.registerSet({ setId: "overlap", servers: ["files"], allowTools: ["x"], denyTools: ["x"] })).toThrow("overlap")
})

test("gateway uses the bound set server before an explicit target", async () => {
  const gateway = makeMcpGateway({ setRegistry: registry(), resolver: { resolve: async () => ({ serverId: "wrong" }) }, upstream: { call: async ({ serverId }) => ({ status: serverId === "files" ? 200 : 500, ok: serverId === "files", durationMs: 1 }) } })
  const result = await gateway.handle({ callId: "c0", agent: "a1", setId: "safe", serverId: "wrong", tool: "read" })
  expect(result).toMatchObject({ ok: true, serverId: "files", setId: "safe" })
})

test("gateway denies set policy with an audited 403", async () => {
  const events: McpGatewayEvent[] = []
  let calls = 0
  const gateway = makeMcpGateway({ setRegistry: registry(), recorder: { record: (event) => void events.push(event) }, upstream: { call: async () => { calls++; return { status: 200, ok: true, durationMs: 1 } } } })
  const result = await gateway.handle({ callId: "c1", agent: "a1", setId: "safe", tool: "write" })
  expect(result).toMatchObject({ ok: false, status: 403, serverId: "files", setId: "safe", detail: "denied_by_set" })
  expect(calls).toBe(0)
  expect(events.map((event) => event.type)).toEqual(["call", "error"])
  expect(events[1]).toMatchObject({ status: 403, setId: "safe", serverId: "files" })
})
