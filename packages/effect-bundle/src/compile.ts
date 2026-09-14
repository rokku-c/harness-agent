import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs"
import { dirname, resolve, join } from "node:path"
import { buildEntry } from "./build-entry.ts"
import { bundleRuntimes, type EffectRuntimeKind } from "./compat.ts"
import type { EffectBundleManifest } from "./manifest.ts"

export interface CompileOptions {
  readonly appDir: string
  readonly outDir?: string
  readonly targets?: readonly EffectRuntimeKind[]
}

const BUILD_TARGET: Readonly<Record<EffectRuntimeKind, "bun" | "browser">> = {
  os: "bun",
  browser: "browser",
  sandbox: "browser",
}

export const entryFor = (runtime: EffectRuntimeKind): string => `entry.${runtime}.js`

export const compileEffectBundle = async (options: CompileOptions): Promise<EffectBundleManifest> => {
  const manifestPath = join(options.appDir, "effect.bundle.json")
  if (!existsSync(manifestPath)) throw new Error("app dir needs effect.bundle.json: " + manifestPath)
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as EffectBundleManifest
  const outRoot = resolve(options.outDir ?? ".effect-bundles", manifest.bundleId + ".effect-bundle")
  mkdirSync(outRoot, { recursive: true })

  const entrySrc = resolve(options.appDir, manifest.entry)
  const targets = options.targets ?? bundleRuntimes(manifest)
  if (targets.length === 0) throw new Error("effect-bundle: nothing to build; declare at least one runtime")

  const entries: Partial<Record<EffectRuntimeKind, string>> = {}
  for (const runtime of targets) {
    const outEntry = join(outRoot, entryFor(runtime))
    buildEntry({ entry: entrySrc, outfile: outEntry, target: BUILD_TARGET[runtime], what: `bundle for runtime "${runtime}"` })
    entries[runtime] = entryFor(runtime)
  }

  const primary = targets.includes("os") ? "os" : targets[0]
  writeFileSync(
    join(outRoot, "effect.bundle.json"),
    JSON.stringify({ ...manifest, entry: entries[primary], entries }, null, 2),
  )
  for (const asset of manifest.assets ?? []) {
    const from = resolve(options.appDir, asset.from)
    if (!existsSync(from)) throw new Error("effect-bundle: declared asset is missing: " + from)
    const to = join(outRoot, asset.to)
    mkdirSync(dirname(to), { recursive: true })
    cpSync(from, to, { recursive: true })
  }
  return manifest
}
