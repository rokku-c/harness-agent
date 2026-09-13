import type { Authz, Principal } from "@effect-agent/effect-authz"
import { principalKey } from "@effect-agent/effect-authz"
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
  /** Grants `caller` the scopes over every node in `toNs`. */
  grant(caller: Principal, toNs: string, scopes: readonly PlaneScope[]): void
  revoke(caller: Principal, toNs: string, scopes: readonly PlaneScope[]): void
  can(caller: Principal, toNs: string, scope: PlaneScope): boolean
  /** The one decision engine every plane check runs through. */
  readonly authz: Authz
  readInterface(caller: Principal, ns: string, appId: string): unknown
  readUi(caller: Principal, ns: string, appId: string): unknown
  readStore(caller: Principal, ns: string, appId: string, key: string): unknown
  writeStore(caller: Principal, ns: string, appId: string, key: string, value: unknown): void
}
