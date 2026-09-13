import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { startEffectServerYaml } from "../src/main.ts"

/**
 * Two apps with one fact between them. The set and the binding are declared on
 * `agentd`, and the gateway reads them from there rather than holding a second
 * copy: the identity the binding is keyed by — `app:agent-1`, the principal the
 * door verified — is issued by the center, so that is where an operator writes
 * it. Configuring the set on the gateway's side instead would be the same fact
 * with two authors and nothing keeping them in step, and the gateway refuses it.
 */
export const registryFixture = async (upstream: string) => {
  const dir = mkdtempSync(join(tmpdir(), "shared-registry-")), yaml = join(dir, "effect.yaml")
  const token = "registry-isolated-test-token"
  const declarations = [
    { id: "agentd", module: "agentd", config: {
      machines: [{ machineId: "m1", name: "One machine" }],
      agents: [{ agentId: "app:agent-1", machineId: "m1", kind: "claude", version: "1" }],
      // the center's own record of where the server is; the door reaches it
      // through the shared registry, which is what announce populates below
      servers: [{ serverId: "echo", endpoint: upstream, transport: "streamable-http" }],
      sets: [{ setId: "coding", name: "Coding", servers: ["echo"], allowTools: ["echo"] }],
      bindings: [{ agentId: "app:agent-1", setIds: ["coding"] }],
    } },
    { id: "mcp-registry", module: "mcp-registry-app", config: { registrationTokens: { echo: token } } },
    { id: "mcp-gateway", module: "mcp-gateway-app", config: { databaseFile: join(dir, "gateway.sqlite") } },
  ]
  for (const item of declarations) {
    const path = join(dir, "apps", item.id); mkdirSync(path, { recursive: true })
    writeFileSync(join(path, "effect.yaml"), JSON.stringify({ id: item.id, transport: "inproc",
      module: resolve(import.meta.dir, "../..", item.module, "src/effect-app.ts"), config: item.config }))
  }
  writeFileSync(yaml, JSON.stringify({ roots: ["apps"], enabled: declarations.map((d) => d.id),
    network: { role: "main", listeners: [{ id: "test", port: 0 }] } }))
  const app = await startEffectServerYaml(yaml, { configFile: join(dir, "config.sqlite") })
  const [port] = await app.listen()
  return { app, url: port.url, token,
    close: async () => { await app.stop(); rmSync(dir, { recursive: true, force: true }) },
  }
}
