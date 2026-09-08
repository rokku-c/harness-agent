/** Bundle manifest — self-describing artifact header (see docs/effect-bundle-mesh.md). */

export type EffectBundleTransport = "inproc" | "stdio" | "http" | "mesh"

export interface EffectBundleManifest {
  readonly bundleId: string
  readonly appId: string
  /** ABI the bundle targets (loading host must satisfy it). */
  readonly abi: string
  /** default namespace; a loader may override (namespace = isolation). */
  readonly namespace: string
  readonly transport: EffectBundleTransport
  readonly requires?: readonly string[]
  readonly provides?: {
    readonly interfaces?: readonly unknown[]
    readonly configSchema?: unknown
    readonly ui?: readonly unknown[]
  }
  /** compiled entry (relative to the bundle dir). */
  readonly entry: string
  /** extra dirs to copy into the bundle (asset resolution via import.meta.url). */
  readonly assets?: readonly { readonly from: string; readonly to: string }[]
}

export const readBundleManifest = (dir: string, fs: { readFileSync: (p: string) => string }): EffectBundleManifest =>
  JSON.parse(fs.readFileSync(dir + "/effect.bundle.json")) as EffectBundleManifest
