/**
 * YAML-backed manifests: parse, discover and load plugins declared as
 * effect.yaml (transport inproc | stdio | http). Auto-discovery scans each
 * root's child directories for an effect.yaml.
 */

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

/** scan each root for `<root>/<child>/effect.yaml`. */
export const discoverManifests = (roots: readonly string[]): readonly Discovered[] => {
  const out: Discovered[] = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root)) {
      const dir = join(root, entry)
      if (!statSync(dir).isDirectory()) continue
      const manifest = readManifest(join(dir, "effect.yaml"))
      if (manifest !== undefined) out.push({ dir, manifest })
    }
  }
  return out
}
