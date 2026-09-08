/** Composition root: discover declarations, initialize SQLite, then activate apps. */
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { readServerYaml } from "./yaml-manifest.ts"
import { bootRuntime } from "./boot/runtime.ts"
import { csv, type EffectServer, type EffectServerOptions } from "./boot/options.ts"
export type { EffectServer, EffectServerOptions } from "./boot/options.ts"

const DEFAULT_PLANES = ["ai-gateway", "board", "mcp"]
export const startEffectServerYaml = async (
  yamlPath: string, options: EffectServerOptions = {},
): Promise<EffectServer> => {
  const cfg = readServerYaml(readFileSync(yamlPath, "utf8")), base = dirname(yamlPath)
  const fromEnv = csv(process.env.EFFECT_PLANES)
  const enabled = new Set(options.planes ?? (fromEnv.length ? fromEnv : cfg.enabled ?? DEFAULT_PLANES))
  return bootRuntime((cfg.roots ?? ["apps", "packages"]).map((root) => resolve(base, root)), enabled,
    { ...options, control: options.control ?? cfg.server?.control ?? process.env.EFFECT_CONTROL === "1", network: options.network ?? cfg.network })
}
export const startEffectServer = async (options: EffectServerOptions = {}): Promise<EffectServer> => {
  const fromEnv = csv(process.env.EFFECT_PLANES)
  return bootRuntime([resolve(import.meta.dir, "../../..", "apps")],
    new Set(options.planes ?? (fromEnv.length ? fromEnv : DEFAULT_PLANES)), options)
}

if (import.meta.main) {
  const yaml = resolve(import.meta.dir, "../../../effect.yaml")
  const app = process.env.EFFECT_NO_YAML !== "1" && existsSync(yaml)
    ? await startEffectServerYaml(yaml) : await startEffectServer()
  const ports = await app.listen()
  console.error(`[effect-server] managed listeners: ${JSON.stringify(ports)} · shared routes`)
  const stop = async () => { await app.stop(); process.exit(0) }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
}
