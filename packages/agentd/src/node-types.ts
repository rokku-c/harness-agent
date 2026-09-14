import type { BundleRef, Machine } from "./types.ts"

export interface NodeAppPlacement {
  readonly bundleId: string
  readonly version: string
  readonly ns: string
  readonly enabled?: boolean
}

export interface ResolvedNodeApp extends BundleRef {
  readonly ns: string
  readonly enabled?: boolean
}

export interface NodeBinding {
  nodeId: string
  revision: number
  kernelId?: string
  placements: readonly string[]
}

export interface DesiredNode {
  readonly node: Machine
  readonly revision: number
  readonly kernel?: BundleRef
  readonly apps: readonly ResolvedNodeApp[]
}
