/**
 * effect-planes — unified interface / ui / storage planes with permissions.
 *
 * Every node (ns::appId) registers its assets; cross-node access is denied by
 * default and only allowed through plane-scoped grants. All reads/writes go
 * through one entry point so authorization is uniform. (Execution of an
 * interface call happens in effect-mesh; here we authorize + expose schemas.)
 */

import { makeNodeStore, type NodeStore } from "./store.ts"
import { makePermissions } from "./permissions.ts"
import type { Planes, PlanesNode, PlaneScope } from "./types.ts"
export type { Planes, PlanesNode, PlaneScope } from "./types.ts"

const keyOf = (ns: string, appId: string): string => `${ns}::${appId}`

export const makePlanes = (): Planes => {
  const nodes = new Map<string, PlanesNode>()
  const permissions = makePermissions()

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
      permissions.grant(fromNs, toNs, scopes)
    },
    revoke(fromNs, toNs, scopes) {
      permissions.revoke(fromNs, toNs, scopes)
    },
    can: permissions.can,

    readInterface(callerNs, ns, appId) {
      const node = nodes.get(keyOf(ns, appId))
      if (node === undefined) throw new Error("planes: no node " + keyOf(ns, appId))
      permissions.require(callerNs, ns, "interface")
      return node.registry?.schemas() ?? []
    },

    readUi(callerNs, ns, appId) {
      const node = nodes.get(keyOf(ns, appId))
      if (node === undefined) throw new Error("planes: no node " + keyOf(ns, appId))
      permissions.require(callerNs, ns, "ui")
      return node.uiDoc?.()
    },

    readStore(callerNs, ns, appId, key) {
      const node = nodes.get(keyOf(ns, appId))
      if (node === undefined) throw new Error("planes: no node " + keyOf(ns, appId))
      permissions.require(callerNs, ns, "store")
      return node.store?.get(key)
    },

    writeStore(callerNs, ns, appId, key, value) {
      const node = nodes.get(keyOf(ns, appId))
      if (node === undefined) throw new Error("planes: no node " + keyOf(ns, appId))
      permissions.require(callerNs, ns, "store-write")
      node.store?.set(key, value)
    },
  }
}
