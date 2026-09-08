import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { NodeStore } from "./store.ts"

export type PlaneScope = "ui" | "store" | "store-write" | "interface"

export interface PlanesNode {
  readonly ns: string
  readonly appId: string
  readonly store?: NodeStore
  readonly uiDoc?: () => unknown
  readonly registry?: EffectRegistry
}

export interface Planes {
  registerNode(node: PlanesNode): () => void
  listNodes(): readonly PlanesNode[]
  grant(fromNs: string, toNs: string, scopes: readonly PlaneScope[]): void
  revoke(fromNs: string, toNs: string, scopes: readonly PlaneScope[]): void
  can(callerNs: string, toNs: string, scope: PlaneScope): boolean
  readInterface(callerNs: string, ns: string, appId: string): unknown
  readUi(callerNs: string, ns: string, appId: string): unknown
  readStore(callerNs: string, ns: string, appId: string, key: string): unknown
  writeStore(callerNs: string, ns: string, appId: string, key: string, value: unknown): void
}
