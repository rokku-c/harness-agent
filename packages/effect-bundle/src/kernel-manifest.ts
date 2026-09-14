import type { EffectRuntimeKind } from "./compat.ts"

export const KERNEL_ENTRY = "kernel.js"

export const KERNEL_MANIFEST = "kernel.bundle.json"

export interface KernelBundleManifest {
  readonly bundleId: string
  readonly abi: string
  readonly bootstrapAbi: string
  readonly runtimes?: readonly EffectRuntimeKind[]
  readonly entry: string
}

const line = (manifest: Partial<KernelBundleManifest>, key: "bundleId" | "abi" | "bootstrapAbi" | "entry"): string => {
  const value = manifest[key]
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`kernel manifest is missing ${key}; a kernel names its identity and both ABI lines`)
  }
  return value
}

export const readKernelManifest = (
  dir: string,
  fs: { readFileSync: (path: string) => string },
): KernelBundleManifest => {
  const parsed = JSON.parse(fs.readFileSync(`${dir}/${KERNEL_MANIFEST}`)) as Partial<KernelBundleManifest>
  const manifest: KernelBundleManifest = {
    bundleId: line(parsed, "bundleId"),
    abi: line(parsed, "abi"),
    bootstrapAbi: line(parsed, "bootstrapAbi"),
    entry: line(parsed, "entry"),
    ...(parsed.runtimes === undefined ? {} : { runtimes: parsed.runtimes }),
  }
  return manifest
}
