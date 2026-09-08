/**
 * bun run up — one command to bring the whole agent up.
 *
 * 1. Boots the home (effect-server) from the root effect.yaml, WITHOUT the
 *    apps that are bundle-managed.
 * 2. For each app listed in `bundles` (env EFFECT_BUNDLES overrides), compiles
 *    it into a bundle and loads it back into the home's host/registry/configs/
 *    uiViews — i.e. the plugin "compiles, then connects back".
 * 3. Binds one port and stays up; prints where each thing lives. Ctrl-C tears
 *    the bundles down, then the server.
 */

import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { compileEffectBundle, loadEffectBundle } from "@effect-agent/effect-bundle"
import { readServerYaml } from "./yaml-manifest.ts"
import { startEffectServerYaml } from "./main.ts"

const ROOT = resolve(import.meta.dir, "../../..")
const yamlPath = resolve(ROOT, "effect.yaml")
const cfg = readServerYaml(readFileSync(yamlPath, "utf8"))

const envBundles = (process.env.EFFECT_BUNDLES ?? "").split(",").map((s) => s.trim()).filter(Boolean)
const bundles = envBundles.length > 0 ? envBundles : (cfg.bundles ?? ["board"])
const exclude = new Set(bundles)
const enabled = (cfg.enabled ?? []).filter((id) => !exclude.has(id))

const server = await startEffectServerYaml(yamlPath, { planes: enabled })
const disposers: Array<() => void | Promise<void>> = []
const outRoot = resolve(ROOT, ".effect-bundles")

for (const name of bundles) {
  const appDir = resolve(ROOT, "apps", name)
  const bundleFile = resolve(appDir, "effect.bundle.json")
  if (!existsSync(bundleFile)) {
    console.error(`[up] skip bundle ${name}: no ${bundleFile}`)
    continue
  }
  const manifest = await compileEffectBundle({ appDir, outDir: outRoot })
  const bundleDir = resolve(outRoot, manifest.bundleId + ".effect-bundle")
  disposers.push(await loadEffectBundle(bundleDir, {
    host: server.host,
    mcpRegistry: server.mcpRegistry,
    network: server.network,
    registry: server.registry!,
    configs: server.configs,
    uiViews: server.uiViews,
    namespace: "ops",
    initializeConfig: server.initializeConfig,
    activeConfig: (id) => server.configRuntime.active(id),
  }))
  console.error(`[up] bundle connected back: ${manifest.bundleId}`)
}

const ports = await server.listen()
console.error(`[up] shared listeners: ${JSON.stringify(ports)} · bundles: ${bundles.join(", ")}`)

const stop = async () => {
  for (const dispose of disposers) await dispose()
  await server.stop()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
