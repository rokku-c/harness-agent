/**
 * effect-planes — unified interface / ui / storage planes with permissions.
 *
 * Every node (ns::appId) registers its assets; cross-node access is denied by
 * default and only allowed through plane-scoped grants. All reads/writes go
 * through one entry point so authorization is uniform. (Execution of an
 * interface call happens in effect-mesh; here we authorize + expose schemas.)
 *
 * A caller is a `Principal`, not a bare namespace: the subject of a grant has to
 * be a real identity, and `principal.id` is what names the caller's own
 * namespace. Authorization runs before the node lookup, so an unauthorized
 * caller cannot tell a node that exists from one that does not.
 */

import type { Authz, Principal } from "@effect-agent/effect-authz"
import { principalKey } from "@effect-agent/effect-authz"
import { planeAction, planeAddress } from "./plane-address.ts"
import { makePlanesAuthz } from "./planes-authz.ts"
import { makeNodeStore } from "./store.ts"
import type { Planes, PlanesNode, PlaneScope } from "./types.ts"
export type { Planes, PlanesNode, PlaneScope } from "./types.ts"

export interface PlanesOptions {
  /** A shared engine (the gateway compiles its views into it). Defaults to the planes' own. */
  readonly authz?: Authz
}

const keyOf = (ns: string, appId: string): string => `${ns}::${appId}`

export const makePlanes = (options: PlanesOptions = {}): Planes => {
  const nodes = new Map<string, PlanesNode>()
  const authz = options.authz ?? makePlanesAuthz()

  const allow = (caller: Principal, ns: string, appId: string, scope: PlaneScope): void =>
    authz.require(caller, planeAction(scope), planeAddress(scope, ns, appId))

  const nodeOf = (ns: string, appId: string): PlanesNode => {
    const node = nodes.get(keyOf(ns, appId))
    if (node === undefined) throw new Error("planes: no node " + keyOf(ns, appId))
    return node
  }

  const each = (scopes: readonly PlaneScope[], apply: (scope: PlaneScope) => void): void => {
    for (const scope of scopes) apply(scope)
  }

  return {
    authz,

    registerNode(node: PlanesNode): () => void {
      const key = keyOf(node.ns, node.appId)
      const entry: PlanesNode = { ns: node.ns, appId: node.appId, store: node.store ?? makeNodeStore(), uiDoc: node.uiDoc, registry: node.registry }
      nodes.set(key, entry)
      let closed = false
      return () => {
        if (closed) return
        closed = true
        if (nodes.get(key) === entry) nodes.delete(key)
      }
    },

    listNodes: () => [...nodes.values()],

    grant: (caller, toNs, scopes) =>
      each(scopes, (scope) =>
        void authz.grant({ subject: principalKey(caller), resource: planeAddress(scope, toNs), actions: [planeAction(scope)] })),

    revoke: (caller, toNs, scopes) =>
      each(scopes, (scope) =>
        void authz.revoke(principalKey(caller), planeAddress(scope, toNs), [planeAction(scope)])),

    can: (caller, toNs, scope) => authz.decide(caller, planeAction(scope), planeAddress(scope, toNs)).allowed,

    readInterface(caller, ns, appId) {
      allow(caller, ns, appId, "interface")
      return nodeOf(ns, appId).registry?.schemas() ?? []
    },

    readUi(caller, ns, appId) {
      allow(caller, ns, appId, "ui")
      return nodeOf(ns, appId).uiDoc?.()
    },

    readStore(caller, ns, appId, key) {
      allow(caller, ns, appId, "store")
      return nodeOf(ns, appId).store?.get(key)
    },

    writeStore(caller, ns, appId, key, value) {
      allow(caller, ns, appId, "store-write")
      nodeOf(ns, appId).store?.set(key, value)
    },
  }
}
