import type { EffectRuntimeKind } from "./compat.ts"

export type EffectBundleTransport = "inproc" | "stdio" | "http" | "mesh"

export interface EffectBundleManifest {
  readonly bundleId: string
  readonly appId: string
  readonly abi: string
  readonly runtimes?: readonly EffectRuntimeKind[]
  readonly namespace: string
  readonly transport: EffectBundleTransport
  readonly requires?: readonly string[]
  readonly provides?: {
    readonly interfaces?: readonly unknown[]
    readonly configSchema?: unknown
    readonly ui?: readonly unknown[]
  }
  readonly entry: string
  readonly entries?: Readonly<Partial<Record<EffectRuntimeKind, string>>>
  readonly assets?: readonly { readonly from: string; readonly to: string }[]
}

export const readBundleManifest = (dir: string, fs: { readFileSync: (p: string) => string }): EffectBundleManifest =>
  JSON.parse(fs.readFileSync(dir + "/effect.bundle.json")) as EffectBundleManifest
