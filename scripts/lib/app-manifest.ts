/**
 * Which apps this repository can host alone, read from `apps/<dir>/effect.yaml`.
 *
 * An app is its manifest `id`, not its directory name — the two differ
 * (mcp-gateway-app -> mcp-gateway). The manifest is the same one the composition
 * root discovers; this reader takes `module`, `transport` and the `config:`
 * layer, and nothing else.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { parse } from "yaml"
import type { EffectAppDescriptor } from "@effect-agent/effect-apps"

/** Two levels up from `scripts/lib`, and the reason this file is not free to move. */
const APPS = resolve(import.meta.dir, "../../apps")

const manifests = (): readonly { id: string; dir: string; file: string }[] =>
  (existsSync(APPS) ? readdirSync(APPS) : [])
    .map((entry) => resolve(APPS, entry))
    .filter((dir) => statSync(dir).isDirectory())
    .flatMap((dir) => {
      const file = resolve(dir, "effect.yaml")
      if (!existsSync(file)) return []
      const id = (parse(readFileSync(file, "utf8")) as { id?: unknown }).id
      return typeof id === "string" ? [{ id, dir, file }] : []
    })

export const hostableApps = (): readonly string[] => manifests().map((m) => m.id).sort()

export const loadApp = async (id: string): Promise<{ app: EffectAppDescriptor; config?: unknown }> => {
  const found = manifests().find((m) => m.id === id)
  if (found === undefined) throw new Error(`no such app: "${id}" · hostable: ${hostableApps().join(", ")}`)
  const manifest = parse(readFileSync(found.file, "utf8")) as { transport?: string; module?: string; config?: unknown }
  if (manifest.transport !== "inproc" || typeof manifest.module !== "string") {
    throw new Error(`app "${id}": only an inproc app can be hosted in this process (transport: ${manifest.transport})`)
  }
  const mod = await import(resolve(found.dir, manifest.module)) as { effectApp?: EffectAppDescriptor }
  if (!mod.effectApp || mod.effectApp.id !== id) throw new Error(`app "${id}": expected a matching effectApp descriptor`)
  return { app: mod.effectApp, config: manifest.config }
}
