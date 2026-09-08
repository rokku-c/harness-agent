import { expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { z } from "@effect-agent/effect-config"
import { registerEffectApp } from "@effect-agent/effect-apps"
import { startEffectServerYaml } from "../src/main.ts"

test("late bundle registration retains its manifest YAML initialization layer", async () => {
  const dir = mkdtempSync(join(tmpdir(), "effect-late-config-"))
  mkdirSync(join(dir, "apps", "late"), { recursive: true })
  writeFileSync(join(dir, "apps", "late", "effect.yaml"), JSON.stringify({
    id: "late", transport: "inproc", config: { limit: 9 },
  }))
  const file = join(dir, "effect.yaml")
  writeFileSync(file, JSON.stringify({ roots: ["apps"], enabled: [] }))
  const app = await startEffectServerYaml(file, { configFile: join(dir, "config.sqlite") })
  let seen: unknown
  try {
    const dispose = await registerEffectApp({ ...app, activeConfig: (id) => app.configRuntime.active(id) }, {
      id: "late", config: { appId: "late", schema: z.object({ limit: z.number().default(1) }) },
      createPlugin: (getConfig) => ({ id: "late", load: async () => {
        seen = getConfig()
        return { canHandle: () => false, handle: async () => new Response(null) }
      } }),
    })
    expect(seen).toEqual({ limit: 9 })
    expect(app.configs.read("late").sources).toEqual({ limit: "yaml" })
    await dispose()
  } finally { await app.stop(); rmSync(dir, { recursive: true, force: true }) }
})
