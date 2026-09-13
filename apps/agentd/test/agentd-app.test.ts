import { expect, test } from "bun:test"
import { makePluginHost } from "@effect-agent/effect-host"
import { createAgentdPlugin } from "../src/effect-plugin.ts"
import { effectApp } from "../src/effect-app.ts"
import { effectConfig } from "../src/effect-config.ts"

test("agentd is a port-free host plugin with a machine-control tool surface", async () => {
  const host = makePluginHost(); await host.register({ ...createAgentdPlugin(), routes: effectApp.routes })
  const status = await (await host.handle(new Request("http://host/agentd"))).json() as { app: string; machines: unknown[] }
  expect(status.app).toBe("agentd")
  expect(status.machines).toEqual([])
  const html = await host.handle(new Request("http://host/agentd", { headers: { accept: "text/html" } }))
  expect(html.headers.get("content-type")).toBe("application/json;charset=utf-8")
  expect(host.routes()).toEqual([{ appId: "agentd", path: "/agentd", match: "prefix" }])
  await host.close()
})

test("agentd seeds machines, agents, servers, sets, and bindings from active config", async () => {
  const host = makePluginHost()
  const config = effectConfig.schema.parse({
    machines: [{ machineId: "m1", name: "Local" }],
    agents: [{ agentId: "a1", machineId: "m1", kind: "effect", version: "1" }],
    servers: [{ serverId: "s1", endpoint: "http://server.test/mcp", transport: "streamable-http" }],
    sets: [{ setId: "safe", name: "Safe", servers: ["s1"] }],
    bindings: [{ agentId: "a1", setIds: ["safe"] }],
  })
  await host.register({ ...createAgentdPlugin(() => config), routes: effectApp.routes })
  const status = await (await host.handle(new Request("http://host/agentd"))).json() as { machines: unknown[]; bindings: unknown[] }
  expect(status.machines).toHaveLength(1)
  expect(status.bindings).toHaveLength(1)
  await host.close()
})
