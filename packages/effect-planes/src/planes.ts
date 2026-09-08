/**
 * effect-planes — unified interface / ui / storage planes with permissions.
 *
 * Every node (ns::appId) registers its assets; cross-node access is denied by
 * default and only allowed through plane-scoped grants. All reads/writes go
 * through one entry point so authorization is uniform. (Execution of an
 * interface call happens in effect-mesh; here we authorize + expose schemas.)
 */

import type { EffectRegistry } from "@effect-agent/effect-interface"
import { makeNodeStore, type NodeStore } from "./store.ts"

export type PlaneScope = "ui" | "store" | "store-write" | "interface"

export interface PlanesNode {
  readonly ns: string
  readonly appId: string
  readonly store?: NodeStore
  /** getter for the node's UiDocument (declaration layer). */
  readonly uiDoc?: () => unknown
  /** interface registry (schemas for discovery/read). */
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

const keyOf = (ns: string, appId: string): string => `${ns}::${appId}`

export const makePlanes = (): Planes => {
  const nodes = new Map<string, PlanesNode>()
  const grants = new Set<string>()
  const granted = (from: string, to: string, scope: PlaneScope): boolean =>
    grants.has(`${from}>${to}:${scope}`)

  const can = (caller: string, to: string, scope: PlaneScope): boolean =>
    caller === to || granted(caller, to, scope)

  const require = (caller: string, to: string, scope: PlaneScope): void => {
    if (!can(caller, to, scope)) {
      throw new Error(`planes: denied — ${caller} cannot ${scope} ${to}`)
    }
  }

  return {
    registerNode(node: PlanesNode): () => void {
      const key = keyOf(node.ns, node.appId)
      const entry: PlanesNode = {
        ns: node.ns,
        appId: node.appId,
        store: node.store ?? makeNodeStore(),
        uiDoc: node.uiDoc,
        registry: node.registry,
      }
      nodes.set(key, entry)
      let closed = false
      return () => {
        if (closed) return
        closed = true
        if (nodes.get(key) === entry) nodes.delete(key)
      }
    },

    listNodes: () => [...nodes.values()],

    grant(fromNs, toNs, scopes) {
      for (const scope of scopes) grants.add(`${fromNs}>${toNs}:${scope}`)
    },
    revoke(fromNs, toNs, scopes) {
      for (const scope of scopes) grants.delete(`${fromNs}>${toNs}:${scope}`)
    },
    can,

    readInterface(callerNs, ns, appId) {
      const node = nodes.get(keyOf(ns, appId))
      if (node === undefined) throw new Error("planes: no node " + keyOf(ns, appId))
      require(callerNs, ns, "interface")
      return node.registry?.schemas() ?? []
    },

    readUi(callerNs, ns, appId) {
      const node = nodes.get(keyOf(ns, appId))
      if (node === undefined) throw new Error("planes: no node " + keyOf(ns, appId))
      require(callerNs, ns, "ui")
      return node.uiDoc?.()
    },

    readStore(callerNs, ns, appId, key) {
      const node = nodes.get(keyOf(ns, appId))
      if (node === undefined) throw new Error("planes: no node " + keyOf(ns, appId))
      require(callerNs, ns, "store")
      return node.store?.get(key)
    },

    writeStore(callerNs, ns, appId, key, value) {
      const node = nodes.get(keyOf(ns, appId))
      if (node === undefined) throw new Error("planes: no node " + keyOf(ns, appId))
      require(callerNs, ns, "store-write")
      node.store?.set(key, value)
    },
  }
}
