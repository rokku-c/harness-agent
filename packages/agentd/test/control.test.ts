import { expect, test } from "bun:test"
import { AgentdError, makeAgentdControl } from "../src/index.ts"

const machine = { machineId: "m1", name: "dev", status: "online" as const, capabilities: ["claude"], namespaces: ["ops"], reportedAt: 1 }
const agent = { agentId: "a1", machineId: "m1", kind: "claude", version: "1", status: "online" as const }
test("agentd binds agents to named MCP sets and rejects stale revisions", () => {
  const control = makeAgentdControl(); control.registerMachine(machine); control.registerAgent(agent)
  control.registerServer({ serverId: "files", endpoint: "http://gateway/files", transport: "streamable-http" })
  control.upsertSet({ setId: "coding", name: "Coding", servers: ["files"], allowTools: ["read"] })
  const binding = control.bindAgent("a1", ["coding"]), desired = control.desired("a1")
  expect(desired.sets[0].setId).toBe("coding"); expect(desired.servers[0].serverId).toBe("files")
  expect(() => control.reportApplied("a1", binding.revision - 1, {})).toThrow(AgentdError)
  expect(control.reportApplied("a1", binding.revision, { ok: true }).revision).toBe(binding.revision)
})
test("agentd rejects topology errors", () => {
  const control = makeAgentdControl(); control.registerMachine(machine); control.registerAgent(agent)
  expect(() => control.upsertSet({ setId: "bad", name: "bad", servers: ["missing"] })).toThrow()
})
