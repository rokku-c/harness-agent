/**
 * compileEffectBundle — turn an app dir into a directory bundle.
 *
 * Reads <appDir>/effect.bundle.json, bundles its entry with `bun build`
 * (externalizing the @effect-agent ABI + zod so the bundle can run anywhere a
 * host provides them), and writes dist/<bundleId>.effect-bundle/ containing
 * entry.js + effect.bundle.json. Transport-dependent assets (ui) are copied as
 * declared in the manifest.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs"
import { resolve, dirname, join } from "node:path"
import { spawnSync } from "node:child_process"
import type { EffectBundleManifest } from "./manifest.ts"

export interface CompileOptions {
  readonly appDir: string
  readonly outDir?: string
}

export const compileEffectBundle = async (options: CompileOptions): Promise<EffectBundleManifest> => {
  const manifestPath = join(options.appDir, "effect.bundle.json")
  if (!existsSync(manifestPath)) throw new Error("app dir needs effect.bundle.json: " + manifestPath)
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as EffectBundleManifest
  const outRoot = resolve(options.outDir ?? ".effect-bundles", manifest.bundleId + ".effect-bundle")
  mkdirSync(outRoot, { recursive: true })

  const entrySrc = resolve(options.appDir, manifest.entry)
  const outEntry = join(outRoot, "entry.js")
  const run = spawnSync(
    process.execPath,
    [
      "build", entrySrc, "--outfile", outEntry,
      "--target", "bun",
      "--external", "@effect-agent/*", "--external", "zod",
      "--external", "react", "--external", "react-dom",
      "--minify",
    ],
    { encoding: "utf8" },
  )
  if (run.status !== 0) {
    throw new Error("bundle build failed: " + (run.stderr || run.stdout))
  }

  writeFileSync(
    join(outRoot, "effect.bundle.json"),
    JSON.stringify({ ...manifest, entry: "entry.js" }, null, 2),
  )
  // copy declared assets so import.meta.url-relative lookups still resolve
  for (const asset of manifest.assets ?? []) {
    const from = resolve(options.appDir, asset.from)
    const to = join(outRoot, asset.to)
    mkdirSync(dirname(to), { recursive: true })
    if (existsSync(from)) cpSync(from, to, { recursive: true })
  }
  void dirname
  return manifest
}
