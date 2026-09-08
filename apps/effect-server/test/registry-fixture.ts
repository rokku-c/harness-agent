import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { startEffectServerYaml } from "../src/main.ts"

export const registryFixture = async () => {
  const dir = mkdtempSync(join(tmpdir(), "shared-registry-")), yaml = join(dir, "effect.yaml")
  const token = "registry-isolated-test-token"
  const declarations = [
    { id: "mcp-registry", module: "mcp-registry-app", config: { registrationTokens: { echo: token } } },
    { id: "mcp-gateway", module: "mcp-gateway-app", config: {
      sets: [{ setId: "coding", name: "Coding", servers: ["echo"], allowTools: ["echo"] }],
      bindings: [{ agentId: "agent-1", setIds: ["coding"] }], defaultAction: "allow",
    } },
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
