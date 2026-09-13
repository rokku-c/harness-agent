/**
 * A kernel artifact's manifest (docs/architecture-rework.md §6.1, P5 第二段).
 *
 * A kernel is not an app, so it does not carry `effect.bundle.json`: that shape
 * says `appId` / `namespace` / `transport`, none of which a kernel has. What a
 * kernel does declare is its two ABI lines — `bootstrapAbi` toward the host,
 * `abi` toward its apps — and those are exactly what this file carries.
 *
 * Declaring both lines is not optional, and a manifest missing one is not a
 * kernel with defaults: it is an artifact nobody can adjudicate. So the refusal
 * happens here, when the manifest is read, rather than downstream where it would
 * surface as a kernel that loads and then behaves like something else.
 */

import type { EffectRuntimeKind } from "./compat.ts"

/** The entry module a kernel artifact directory exposes — `loadKernel` imports this. */
export const KERNEL_ENTRY = "kernel.js"

/** Where a kernel artifact keeps its own header, beside the compiled entry. */
export const KERNEL_MANIFEST = "kernel.bundle.json"

export interface KernelBundleManifest {
  /** Version-laden identity, e.g. `io.effect-agent.effect-server@0.0.0`. */
  readonly bundleId: string
  /** `effect-N` line this kernel implements *toward its apps*. */
  readonly abi: string
  /** `bootstrap-N` line this kernel needs *from its host*. */
  readonly bootstrapAbi: string
  /** Runtimes the kernel can execute in; absent = ["os"] (`bundleRuntimes`). */
  readonly runtimes?: readonly EffectRuntimeKind[]
  /** Source entry, relative to the kernel dir. In the artifact this is {@link KERNEL_ENTRY}. */
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
