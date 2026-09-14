import { parse } from "yaml"
import { serverSchema } from "./server-schema.ts"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import type { EffectManifest, EffectServerYaml } from "./manifest.ts"

export const readServerYaml = (source: string): EffectServerYaml =>
  serverSchema.parse(parse(source) ?? {}) as EffectServerYaml

export const readManifest = (file: string): EffectManifest | undefined => {
  if (!existsSync(file)) return undefined
  const raw = readFileSync(file, "utf8")
  const parsed = (parse(raw) ?? {}) as Partial<EffectManifest>
  if (typeof parsed.id !== "string" || typeof parsed.transport !== "string") return undefined
  if (!["inproc", "stdio", "http"].includes(parsed.transport)) return undefined
  return parsed as EffectManifest
}

export interface Discovered {
  readonly dir: string
  readonly manifest: EffectManifest
}

export const discoverManifests = (roots: readonly string[]): readonly Discovered[] => {
  const out: Discovered[] = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root)) {
      if (entry.startsWith(".")) continue
      const dir = join(root, entry)
      let isDirectory: boolean
      try { isDirectory = statSync(dir).isDirectory() } catch { continue }
      if (!isDirectory) continue
      const manifest = readManifest(join(dir, "effect.yaml"))
      if (manifest !== undefined) out.push({ dir, manifest })
    }
  }
  return out
}
