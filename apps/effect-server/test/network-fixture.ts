import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { startEffectServerYaml } from "../src/main.ts"

export const networkFixture = async (network: unknown) => {
  const dir = mkdtempSync(join(tmpdir(), "effect-network-host-"))
  const file = join(dir, "effect.yaml")
  writeFileSync(file, JSON.stringify({ roots: [], enabled: ["console", "config"], network }))
  const app = await startEffectServerYaml(file, { configFile: join(dir, "config.sqlite") })
  return { app, close: async () => { await app.stop(); rmSync(dir, { recursive: true, force: true }) } }
}
