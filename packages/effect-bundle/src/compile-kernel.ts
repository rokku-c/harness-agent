import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { resolve, join } from "node:path"
import { buildEntry } from "./build-entry.ts"
import { KERNEL_ENTRY, KERNEL_MANIFEST, readKernelManifest, type KernelBundleManifest } from "./kernel-manifest.ts"

export interface KernelCompileOptions {
  readonly kernelDir: string
  readonly outDir?: string
}

export const kernelBundleDir = (outDir: string, bundleId: string): string =>
  resolve(outDir, bundleId + ".effect-bundle")

export const compileKernelRevision = async (options: KernelCompileOptions): Promise<KernelBundleManifest> => {
  const manifest = readKernelManifest(options.kernelDir, { readFileSync: (path) => readFileSync(path, "utf8") })
  const outRoot = kernelBundleDir(options.outDir ?? ".effect-bundles", manifest.bundleId)
  mkdirSync(outRoot, { recursive: true })

  const outEntry = join(outRoot, KERNEL_ENTRY)
  buildEntry({ entry: resolve(options.kernelDir, manifest.entry), outfile: outEntry, target: "bun", what: "kernel" })

  writeFileSync(join(outRoot, KERNEL_MANIFEST), JSON.stringify({ ...manifest, entry: KERNEL_ENTRY }, null, 2))
  return manifest
}
