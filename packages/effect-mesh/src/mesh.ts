import { makeStore } from "./store"
import { callNode, discover } from "./operations"
export * from "./types"
import type { EffectMesh, MeshAnnounce, MeshCall, MeshDiscover, MeshOptions } from "./types"

export const makeMesh = (options: MeshOptions = {}): EffectMesh => {
  const store = makeStore(), grants = new Set<string>()
  const can = (from: string | undefined, to: string) => from === undefined || from === to || grants.has(`${from}>${to}`)
  return {
    announce(a: MeshAnnounce) { return store.announce(a).dispose }, leave: (key) => store.nodes.delete(key), list: store.list,
    discover: (q: MeshDiscover) => discover(store.nodes, q), grant(from, to) { grants.add(`${from}>${to}`) },
    revoke(from, to) { grants.delete(`${from}>${to}`) }, can,
    async call(c: MeshCall, args: unknown, opts?: { byNamespace?: string }) {
      const caller = opts?.byNamespace ?? c.ns
      if (!can(caller, c.ns)) throw new Error(`mesh: namespace isolated — ${caller} cannot reach ${c.ns} (grant it)`)
      return callNode(store.nodes, options, c, args, caller)
    },
    async push(c, payload) {
      const key = `${c.ns}::${c.appId}`, node = store.nodes.get(key)
      if (!node?.eventsUrl) throw new Error("mesh: no push target for " + key + " (needs eventsUrl)")
      const res = await fetch(node.eventsUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "mesh/push", params: { ...c, payload } }) })
      if (!res.ok) throw new Error("mesh push failed: " + res.status)
    },
  }
}
