import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { createAgentdPlugin } from "../src/effect-plugin.ts"
import { effectApp } from "../src/effect-app.ts"
import { effectConfig } from "../src/effect-config.ts"

test("agentd exposes desired config, validates applied revisions, and reports drift", async () => {
  const host = makePluginHost()
  const config = effectConfig.schema.parse({
    machines: [{ machineId: "m1", name: "Local" }],
    agents: [{ agentId: "a1", machineId: "m1", kind: "effect", version: "1" }],
    servers: [{ serverId: "s1", endpoint: "http://server.test/mcp", transport: "streamable-http" }],
    sets: [{ setId: "safe", name: "Safe", servers: ["s1"] }],
    bindings: [{ agentId: "a1", setIds: ["safe"] }],
  })
  await host.register({ ...createAgentdPlugin(() => config), routes: effectApp.routes })
  try {
    const desired = await (await host.handle(new Request("http://host/agentd/desired?agentId=a1"))).json() as { desired: { revision: number } }
    expect(desired.desired.revision).toBeGreaterThan(0)
    const stale = await host.handle(new Request("http://host/agentd/report", { method: "POST", body: JSON.stringify({ agentId: "a1", revision: 0 }) }))
    expect(stale.status).toBe(409)
    const accepted = await host.handle(new Request("http://host/agentd/report", { method: "POST", body: JSON.stringify({ agentId: "a1", revision: desired.desired.revision, state: { applied: true } }) }))
    expect(accepted.status).toBe(200)
    const status = await (await host.handle(new Request("http://host/agentd"))).json() as {
      agents: Array<{ agentId: string; applied: { agentId: string; revision: number } | null; desired: { agent: { agentId: string }; revision: number } }>
    }
    // The receipt and the deployment are fields of the agent they are about: the
    // console reads one row per agent rather than joining three lists by eye.
    expect(status.agents[0]!.applied).toMatchObject({ agentId: "a1", revision: desired.desired.revision })
    expect(status.agents[0]!.desired.agent.agentId).toBe("a1")
  } finally { await host.close() }
})
