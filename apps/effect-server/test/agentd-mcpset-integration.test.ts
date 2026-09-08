import { expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { startEffectServerYaml } from "../src/main.ts"

test("effect-server loads agentd and MCP Gateway as port-free platform apps", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agentd-mcpset-")), yaml = join(dir, "effect.yaml")
  writeFileSync(yaml, `roots:\n  - ${resolve(import.meta.dir, "../../../")}/apps\nenabled:\n  - agentd\n  - mcp-gateway\n  - config\n  - console\n  - effect-apps\nnetwork:\n  role: main\n  listeners: []\n`)
  const app = await startEffectServerYaml(yaml, { configFile: join(dir, "config.sqlite") })
  try {
    expect((await app.host.handle(new Request("http://host/agentd"))).status).toBe(200)
    const registry = await app.host.handle(new Request("http://host/mcp-registry"))
    expect(registry.status).toBe(200)
    expect((await registry.json()).app).toBe("mcp-registry")
    const servers = await app.host.handle(new Request("http://host/-/registry/servers"))
    expect((await servers.json()).servers).toEqual([])
    expect((await app.host.handle(new Request("http://host/mcp"))).status).toBe(404)
    expect((await app.host.handle(new Request("http://host/mcp-gateway"))).status).toBe(200)
    expect(app.listeners()).toEqual([])
    const tools = app.registry.tools().map((tool) => tool.key)
    expect(tools).toContain("agentd.agentd_status")
    expect(tools).toContain("agentd.agentd_bind")
    expect(tools).toContain("mcp-gateway.mcp_gateway_topology")
  } finally { await app.stop(); rmSync(dir, { recursive: true, force: true }) }
})
