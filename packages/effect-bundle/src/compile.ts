/**
 * compileEffectBundle — turn an app dir into a directory bundle.
 *
 * Reads <appDir>/effect.bundle.json, bundles its entry with `bun build`
 * (externalizing the @effect-agent ABI + zod so the bundle can run anywhere a
 * host provides them), and writes <outDir>/<bundleId>.effect-bundle/ containing
 * the compiled entry per runtime + effect.bundle.json. Transport-dependent
 * assets (ui) are copied as declared in the manifest.
 *
 * **One build per declared runtime** (§7.5-2). The manifest's `runtimes` says
 * where the artifact claims to run; each of those gets its own entry, and the
 * loader picks the one matching the host it finds itself in. A bundle that
 * declares nothing still gets exactly one build, so nothing that worked before
 * changes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs"
import { dirname, resolve, join } from "node:path"
import { buildEntry } from "./build-entry.ts"
import { bundleRuntimes, type EffectRuntimeKind } from "./compat.ts"
import type { EffectBundleManifest } from "./manifest.ts"

export interface CompileOptions {
  readonly appDir: string
  readonly outDir?: string
  /** Runtimes to build for. Defaults to the manifest's declared `runtimes`. */
  readonly targets?: readonly EffectRuntimeKind[]
}

/**
 * Runtime → `bun build --target`.
 *
 * `browser` for both browser and sandbox, deliberately: `--target browser`
 * forbids node builtins, which is what a sandbox needs from the *compiler*. The
 * difference between the two is not in the emitted bytes — it is in what the
 * host injects at load time (`runtime.ts`), and pretending otherwise by
 * inventing a third build mode would misplace the distinction.
 */
const BUILD_TARGET: Readonly<Record<EffectRuntimeKind, "bun" | "browser">> = {
  os: "bun",
  browser: "browser",
  sandbox: "browser",
}

/** `entry.os.js` — one compiled entry per runtime. */
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

  // `entry` stays the primary/default build so callers that predate `entries`
  // keep resolving correctly; `entries` is what a runtime-aware loader reads.
  const primary = targets.includes("os") ? "os" : targets[0]
  writeFileSync(
    join(outRoot, "effect.bundle.json"),
    JSON.stringify({ ...manifest, entry: entries[primary], entries }, null, 2),
  )
  // copy declared assets so import.meta.url-relative lookups still resolve
  for (const asset of manifest.assets ?? []) {
    const from = resolve(options.appDir, asset.from)
    const to = join(outRoot, asset.to)
    mkdirSync(dirname(to), { recursive: true })
    if (existsSync(from)) cpSync(from, to, { recursive: true })
  }
  return manifest
}
