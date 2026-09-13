/** Composition root: discover declarations, initialize SQLite, then activate apps. */
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { kernelStatePath } from "@effect-agent/effect-bundle"
import { readServerYaml } from "./yaml-manifest.ts"
import { bootRuntime } from "./boot/runtime.ts"
import { csv, type EffectServer, type EffectServerOptions } from "./boot/options.ts"
export type { EffectServer, EffectServerOptions } from "./boot/options.ts"

const DEFAULT_PLANES = ["ai-gateway", "board"]
/**
 * A real server persists the kernel index (§6.1's artifact repo) so the next
 * start has a rollback target. Tests and embedded hosts leave it unset and get an
 * in-memory index — no boot should depend on a writable cwd.
 */
const withKernelState = (base: string, options: EffectServerOptions): EffectServerOptions =>
  options.kernelStateFile === undefined && options.kernelRepo === undefined
    ? { ...options, kernelStateFile: kernelStatePath(resolve(base, ".effect-bundles")) }
    : options

export const startEffectServerYaml = async (
  yamlPath: string, options: EffectServerOptions = {},
): Promise<EffectServer> => {
  const cfg = readServerYaml(readFileSync(yamlPath, "utf8")), base = dirname(yamlPath)
  const fromEnv = csv(process.env.EFFECT_PLANES)
  const enabled = new Set(options.planes ?? (fromEnv.length ? fromEnv : cfg.enabled ?? DEFAULT_PLANES))
  return bootRuntime((cfg.roots ?? ["apps", "packages"]).map((root) => resolve(base, root)), enabled,
    withKernelState(base, { ...options, control: options.control ?? cfg.server?.control ?? process.env.EFFECT_CONTROL === "1",
      dev: options.dev ?? process.env.EFFECT_DEV === "1", network: options.network ?? cfg.network }))
}
export const startEffectServer = async (options: EffectServerOptions = {}): Promise<EffectServer> => {
  const fromEnv = csv(process.env.EFFECT_PLANES)
  const base = resolve(import.meta.dir, "../../..")
  return bootRuntime([resolve(base, "apps")],
    new Set(options.planes ?? (fromEnv.length ? fromEnv : DEFAULT_PLANES)), withKernelState(base, options))
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
