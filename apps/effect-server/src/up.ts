import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { readServerYaml } from "./yaml-manifest.ts"
import { startEffectServerYaml } from "./main.ts"

const ROOT = resolve(import.meta.dir, "../../..")
const yamlPath = resolve(ROOT, "effect.yaml")
const cfg = readServerYaml(readFileSync(yamlPath, "utf8"))

const envBundles = (process.env.EFFECT_BUNDLES ?? "").split(",").map((s) => s.trim()).filter(Boolean)
const named = envBundles.length > 0 ? envBundles : (cfg.bundles ?? ["board"])
const apps = named.flatMap((appId) => {
  const appDir = resolve(ROOT, "apps", appId)
  if (existsSync(resolve(appDir, "effect.bundle.json"))) return [{ appId, appDir }]
  console.error(`[up] skip bundle ${appId}: no ${appDir}/effect.bundle.json`)
  return []
})
const enabled = (cfg.enabled ?? []).filter((id) => !named.includes(id))

const server = await startEffectServerYaml(yamlPath, {
  planes: enabled,
  bundles: apps,
  bundleRoot: resolve(ROOT, ".effect-bundles"),
})

const ports = await server.listen()
console.error(`[up] shared listeners: ${JSON.stringify(ports)} · bundles: ${apps.map((a) => a.appId).join(", ")}`)
const failed = server.bundleFailures()
if (failed.length > 0) {
  console.error(`[up] the home is up without ${failed.join(", ")}; fix the cause above and reload: `
    + failed.map((id) => `POST /-/planes/${id}/reload`).join(", "))
}

const stop = async () => {
  await server.stop()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
