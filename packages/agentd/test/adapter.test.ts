import { expect, test } from "bun:test"
import { makeGatewayConfigAdapter } from "../src/index.ts"

const agent = { agentId: "app:agent-1", machineId: "machine-1", kind: "claude", version: "1", status: "online" as const }
const desired = {
  agent, revision: 7, credential: "t_secret-for-this-identity",
  sets: [{ setId: "coding", name: "Coding", servers: ["private-server"] }],
  servers: [{ serverId: "private-server", endpoint: "https://secret.invalid", transport: "streamable-http" as const }],
}
const at = (over: object = {}) => ({ ...desired, ...over })

test("the gateway adapter presents a credential and claims no identity", () => {
  const plan = makeGatewayConfigAdapter("https://gateway.invalid/mcp-gateway").plan(agent, at())
  expect(plan.revision).toBe(7)
  expect(plan.desired).toMatchObject({
    mcpServers: { effectGateway: { url: "https://gateway.invalid/mcp-gateway", headers: { authorization: "Bearer t_secret-for-this-identity" } } },
  })
  // The agent it is for is a fact about the *plan*, not a claim the config makes
  // to the door: the door names a caller from the credential it verified and
  // never from a field the caller supplied, so an id among these headers would be
  // the F6 defect one layer down. Exactly one header crosses, and it is not an
  // identity. (`metadata` is the receipt the agent reports back to the center —
  // it goes to agentd, never to the gateway.)
  expect(Object.keys(plan.desired.mcpServers.effectGateway.headers)).toEqual(["authorization"])
  // …and the upstream's own address never crosses: the agent is given the door.
  expect(JSON.stringify(plan.desired)).not.toContain("private-server")
  expect(JSON.stringify(plan.desired)).not.toContain("secret.invalid")
})

test("a config the door would refuse is not planned at all", () => {
  const adapter = makeGatewayConfigAdapter("https://gateway.invalid/mcp-gateway")
  // An agent with no credential is refused by the door outright, so handing it a
  // config that says so would fail at the agent, far from the operator who could
  // have issued one — and read as a refusal about sets.
  expect(() => adapter.plan(agent, at({ credential: undefined }))).toThrow(/holds no MCP Gateway credential/)
  const plan = adapter.plan(agent, at())
  adapter.validate(plan.desired)
  // A header carrying nothing is not a credential, and an id smuggled in beside
  // it is not one either.
  expect(() => adapter.validate({ ...plan.desired, mcpServers: { effectGateway: { url: "https://gateway.invalid/mcp-gateway", headers: { authorization: "Bearer " } } } })).toThrow()
  expect(() => adapter.validate({ ...plan.desired, mcpServers: { effectGateway: { url: "https://gateway.invalid/mcp-gateway", headers: { "x-agent-id": "app:agent-1" } } } })).toThrow()
  expect(() => adapter.validate({ mcpServers: { backend: {} }, metadata: {} })).toThrow()
})

test("applying a config does not make the next plan a change", async () => {
  const adapter = makeGatewayConfigAdapter("https://gateway.invalid/mcp-gateway")
  const first = adapter.plan(agent, at())
  expect(await adapter.apply(first)).toEqual(first.desired)
  // The receipt is what the agent reported back. A credential read once per plan
  // rather than held would rotate the header on every poll, so every plan would
  // report an identity change and the apply would never settle — the loop this
  // shape exists to make impossible.
  expect(adapter.plan(agent, at(), first.desired).changes).toEqual([])
  expect(adapter.plan(agent, at({ credential: "t_rotated" }), first.desired).changes).toEqual(["update gateway credential"])
  expect(adapter.plan(agent, at({ revision: 8 }), first.desired).changes).toEqual(["update revision"])
  // A rollback is the receipt's own concurrency rule, the same as every adapter.
  expect(() => adapter.plan(agent, at({ revision: 6 }), first.desired)).toThrow(/stale agent revision/)
  // …and a receipt for another agent is not this agent's receipt.
  expect(() => adapter.plan(agent, at(), { ...first.desired, metadata: { ...first.desired.metadata, agentId: "app:other" } })).toThrow(/reported agent identity mismatch/)
})
