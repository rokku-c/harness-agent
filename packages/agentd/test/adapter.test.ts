import { expect, test } from "bun:test"
import { makeGatewayConfigAdapter } from "../src/index.ts"

test("gateway adapter emits only gateway endpoint and agent identity", () => {
  const agent = { agentId: "agent-1", machineId: "machine-1", kind: "claude", version: "1", status: "online" as const }
  const desired = { agent, revision: 7, sets: [{ setId: "coding", name: "Coding", servers: ["private-server"] }], servers: [{ serverId: "private-server", endpoint: "https://secret.invalid", transport: "streamable-http" as const }] }
  const plan = makeGatewayConfigAdapter("https://gateway.invalid/mcp-gateway/call").plan(agent, desired)
  expect(plan.revision).toBe(7)
  expect(JSON.stringify(plan.desired)).not.toContain("private-server")
  expect(plan.desired).toMatchObject({ mcpServers: { effectGateway: { url: "https://gateway.invalid/mcp-gateway/call", headers: { "x-agent-id": "agent-1" } } } })
})

test("gateway adapter validates its contract and rejects revision rollback", async () => {
  const adapter = makeGatewayConfigAdapter("https://gateway.invalid/mcp-gateway/call")
  const agent = { agentId: "agent-1", machineId: "machine-1", kind: "claude", version: "1", status: "online" as const }
  const desired = { agent, revision: 3, sets: [], servers: [] }
  const plan = adapter.plan(agent, desired)
  adapter.validate(plan.desired)
  expect(await adapter.apply(plan)).toEqual(plan.desired)
  expect(() => adapter.plan(agent, { ...desired, revision: 2 }, plan.desired)).toThrow()
  expect(() => adapter.validate({ mcpServers: { backend: {} }, metadata: {} })).toThrow()
})
