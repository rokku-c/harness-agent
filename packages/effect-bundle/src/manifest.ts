/** Bundle manifest — self-describing artifact header (see docs/effect-bundle-mesh.md). */

import type { EffectRuntimeKind } from "./compat.ts"

export type EffectBundleTransport = "inproc" | "stdio" | "http" | "mesh"

export interface EffectBundleManifest {
  readonly bundleId: string
  readonly appId: string
  /** ABI the bundle targets (loading host must satisfy it). */
  readonly abi: string
  /**
   * Runtimes this bundle can execute in (see docs/architecture-rework.md §7).
   * Absent = ["os"] — the conservative default: a bundle that never declared
   * portability only runs where it was built (the OS/Bun host).
   */
  readonly runtimes?: readonly EffectRuntimeKind[]
  /** default namespace; a loader may override (namespace = isolation). */
  readonly namespace: string
  readonly transport: EffectBundleTransport
  readonly requires?: readonly string[]
  readonly provides?: {
    readonly interfaces?: readonly unknown[]
    readonly configSchema?: unknown
    readonly ui?: readonly unknown[]
  }
  /** compiled entry (relative to the bundle dir) — the default/primary one. */
  readonly entry: string
  /**
   * Compiled entry per runtime, when the artifact was built for more than one
   * (§7.5-2). A loader picks `entries[runtime]` and falls back to `entry`, so an
   * artifact built before this field existed keeps loading unchanged.
   */
  readonly entries?: Readonly<Partial<Record<EffectRuntimeKind, string>>>
  /** extra dirs to copy into the bundle (asset resolution via import.meta.url). */
  readonly assets?: readonly { readonly from: string; readonly to: string }[]
}

export const readBundleManifest = (dir: string, fs: { readFileSync: (p: string) => string }): EffectBundleManifest =>
  JSON.parse(fs.readFileSync(dir + "/effect.bundle.json")) as EffectBundleManifest
