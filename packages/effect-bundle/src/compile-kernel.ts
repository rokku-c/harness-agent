/**
 * compileKernelRevision — turn a kernel dir into an artifact directory.
 *
 * The `P3 → P6` chain had every link but this one: an app could be *built*
 * (`compileEffectBundle`), a kernel could be *loaded* from a directory
 * (`kernel/load.ts`), and bytes could be *pushed* to a node (P6) — but nothing
 * could produce a kernel artifact, so staging one meant hand-writing a module
 * that exports `createKernel`. This is the missing build step, and it is
 * deliberately the same shape as the app compiler: one `bun build`, one manifest
 * written beside the entry, no second artifact format.
 *
 * What it refuses, it refuses at **build** time: a manifest that names no
 * `bootstrapAbi` or no `abi` is not a kernel anything can adjudicate, and finding
 * that out on a target machine during a swap is far too late. A manifest naming a
 * *different* bootstrap line is a different matter and is not refused here —
 * building for a host line this checkout does not implement is a legitimate thing
 * to do, and the host's own gate is where that verdict belongs.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve, join } from "node:path"
import { spawnSync } from "node:child_process"
import { BUNDLE_EXTERNALS } from "./externals.ts"
import { KERNEL_ENTRY, KERNEL_MANIFEST, readKernelManifest, type KernelBundleManifest } from "./kernel-manifest.ts"

export interface KernelCompileOptions {
  /** The kernel's source dir: holds `kernel.bundle.json` and the entry it names. */
  readonly kernelDir: string
  /** Where to write `<bundleId>.effect-bundle`. Defaults to `.effect-bundles`. */
  readonly outDir?: string
}

/** The artifact directory a kernel revision's `dir` points at. */
export const kernelBundleDir = (outDir: string, bundleId: string): string =>
  resolve(outDir, bundleId + ".effect-bundle")

export const compileKernelRevision = async (options: KernelCompileOptions): Promise<KernelBundleManifest> => {
  const manifest = readKernelManifest(options.kernelDir, { readFileSync: (path) => readFileSync(path, "utf8") })
  const outRoot = kernelBundleDir(options.outDir ?? ".effect-bundles", manifest.bundleId)
  mkdirSync(outRoot, { recursive: true })

  const outEntry = join(outRoot, KERNEL_ENTRY)
  const run = spawnSync(
    process.execPath,
    [
      "build", resolve(options.kernelDir, manifest.entry), "--outfile", outEntry,
      "--target", "bun",
      ...BUNDLE_EXTERNALS.flatMap((name) => ["--external", name]),
      "--minify",
    ],
    { encoding: "utf8" },
  )
  if (run.status !== 0) {
    throw new Error("kernel build failed: " + (run.stderr || run.stdout))
  }

  // The artifact's manifest names the *compiled* entry, so the directory is read
  // by the same rule whether you are looking at the source or at the build.
  writeFileSync(join(outRoot, KERNEL_MANIFEST), JSON.stringify({ ...manifest, entry: KERNEL_ENTRY }, null, 2))
  return manifest
}
