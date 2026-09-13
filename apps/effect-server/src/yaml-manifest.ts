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
      // A hidden child is not an app. The reload staging directory is one, and
      // `generation.ts` puts it under an app root precisely so discovery does
      // not look at it.
      if (entry.startsWith(".")) continue
      const dir = join(root, entry)
      // The root's own guard, one level down: this walk runs from a watcher, and
      // a directory can be gone between the listing and the look — a reload
      // sweep removes one while the walk is in it. Throwing here took the whole
      // dev server down; a directory nobody can stat is a directory with no app
      // in it, which is exactly what a failed `existsSync` means above.
      let isDirectory: boolean
      try { isDirectory = statSync(dir).isDirectory() } catch { continue }
      if (!isDirectory) continue
      const manifest = readManifest(join(dir, "effect.yaml"))
      if (manifest !== undefined) out.push({ dir, manifest })
    }
  }
  return out
}
