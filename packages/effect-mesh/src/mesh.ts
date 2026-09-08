/**
 * effect-mesh core — namespace-first mesh over local effect-interface
 * registries (memory transport).
 *
 * Every participant is a node keyed `ns::appId`, backed by an EffectRegistry.
 * A call is routed to the owning node's tool `ns::appId.tool`. Namespaces are
 * isolated by default: a caller may only reach its own namespace, unless an
 * explicit grant opens a direction (fromNs -> toNs). This is the shape remote
 * transports announce into (they provide capabilities + an endpoint instead of
 * a local registry).
 */

import { invoke, type EffectRegistry } from "@effect-agent/effect-interface"

export interface MeshEndpoint {
  /** where this node can be invoked (its own mesh/json-rpc server). */
  readonly url: string
}

export interface MeshRemoteCall {
  (c: MeshCall, args: unknown, opts?: { byNamespace?: string }): Promise<unknown>
}

export interface MeshAnnounce {
  readonly ns: string
  readonly appId: string
  /** local registry for this node (leaf-side use only). */
  readonly registry?: EffectRegistry
  /** protocol callable — when present the node is reached only via protocol. */
  readonly remote?: MeshRemoteCall
  readonly capabilities?: readonly string[]
  /** remote node: calls are proxied here instead of local invoke. */
  readonly endpoint?: MeshEndpoint
  /** remote node: host pushes (ui/events) are delivered here. */
  readonly eventsUrl?: string
}

export interface MeshNode {
  readonly key: string
  readonly ns: string
  readonly appId: string
  readonly capabilities: readonly string[]
}

export interface MeshDiscover {
  readonly ns?: string
  readonly capability?: string
}

export interface MeshCall {
  readonly ns: string
  readonly appId: string
  readonly tool: string
}

export interface EffectMesh {
  announce(a: MeshAnnounce): () => void
  leave(key: string): boolean
  list(): readonly MeshNode[]
  discover(q: MeshDiscover): readonly MeshNode[]
  /** explicit authorization: fromNs may reach toNs. */
  grant(fromNs: string, toNs: string): void
  revoke(fromNs: string, toNs: string): void
  can(fromNs: string | undefined, toNs: string): boolean
  call(c: MeshCall, args: unknown, opts?: { byNamespace?: string }): Promise<unknown>
  /** deliver a host push (ui/events) to a remote node's eventsUrl. */
  push(c: { ns: string; appId: string }, payload: unknown): Promise<void>
}

const toolKey = (ns: string, appId: string, tool: string): string => `${ns}::${appId}.${tool}`

export interface MeshAudit {
  readonly ns: string
  readonly appId: string
  readonly tool: string
  readonly args?: unknown
  readonly byNamespace?: string
}

export interface MeshOptions {
  /** observed on every call (after isolation check) — audit/gate hook. */
  readonly onCall?: (audit: MeshAudit) => void | Promise<void>
}

export const makeMesh = (options: MeshOptions = {}): EffectMesh => {
  const nodes = new Map<string, {
    announce: MeshAnnounce
    registry?: EffectRegistry
    endpoint?: MeshEndpoint
    eventsUrl?: string
    remote?: MeshRemoteCall
  }>()
  const grants = new Set<string>()

  return {
    announce(a: MeshAnnounce): () => void {
      const key = `${a.ns}::${a.appId}`
      const entry = {
        announce: a,
        registry: a.registry,
        endpoint: a.endpoint,
        eventsUrl: a.eventsUrl,
        remote: a.remote,
      }
      nodes.set(key, entry)
      let left = false
      return () => {
        if (left) return
        left = true
        if (nodes.get(key) === entry) nodes.delete(key)
      }
    },

    leave(key: string): boolean {
      return nodes.delete(key)
    },

    list(): readonly MeshNode[] {
      return [...nodes.entries()].map(([key, e]) => ({
        key,
        ns: e.announce.ns,
        appId: e.announce.appId,
        capabilities: e.announce.capabilities ?? [],
      }))
    },

    discover(q: MeshDiscover): readonly MeshNode[] {
      return [...nodes.entries()]
        .filter(([, e]) => q.ns === undefined || e.announce.ns === q.ns)
        .filter(([, e]) => q.capability === undefined || (e.announce.capabilities ?? []).includes(q.capability))
        .map(([key, e]) => ({ key, ns: e.announce.ns, appId: e.announce.appId, capabilities: e.announce.capabilities ?? [] }))
    },

    grant(fromNs: string, toNs: string): void {
      grants.add(`${fromNs}>${toNs}`)
    },
    revoke(fromNs: string, toNs: string): void {
      grants.delete(`${fromNs}>${toNs}`)
    },
    can(fromNs: string | undefined, toNs: string): boolean {
      return fromNs === undefined || fromNs === toNs || grants.has(`${fromNs}>${toNs}`)
    },

    async call(c: MeshCall, args: unknown, opts?: { byNamespace?: string }): Promise<unknown> {
      const key = `${c.ns}::${c.appId}`
      const node = nodes.get(key)
      if (node === undefined) throw new Error("mesh: no node " + key)
      const callerNs = opts?.byNamespace ?? c.ns
      if (!this.can(callerNs, c.ns)) {
        throw new Error(`mesh: namespace isolated — ${callerNs} cannot reach ${c.ns} (grant it)`)
      }
      if (options.onCall !== undefined) {
        await options.onCall({ ns: c.ns, appId: c.appId, tool: c.tool, args, byNamespace: callerNs })
      }
      if (node.remote !== undefined) {
        return node.remote(c, args, { byNamespace: callerNs })
      }
      if (node.endpoint !== undefined) {
        const res = await fetch(node.endpoint.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "mesh/call",
            params: { ns: c.ns, appId: c.appId, tool: c.tool, arguments: args, byNamespace: callerNs },
          }),
        })
        const payload = (await res.json()) as { result?: unknown; error?: { message?: string } }
        if (payload.error !== undefined) throw new Error("mesh remote: " + (payload.error.message ?? "error"))
        return payload.result
      }
      if (node.registry === undefined) {
        throw new Error("mesh: node " + key + " has no local registry (protocol node)")
      }
      const tool = node.registry.tools().find((t) => t.key === toolKey(c.ns, c.appId, c.tool))
      if (tool === undefined) throw new Error("mesh: unknown tool " + toolKey(c.ns, c.appId, c.tool))
      return invoke(tool.tool, args)
    },

    async push(c: { ns: string; appId: string }, payload: unknown): Promise<void> {
      const key = `${c.ns}::${c.appId}`
      const node = nodes.get(key)
      if (node === undefined || node.eventsUrl === undefined) {
        throw new Error("mesh: no push target for " + key + " (needs eventsUrl)")
      }
      const res = await fetch(node.eventsUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "mesh/push", params: { ns: c.ns, appId: c.appId, payload } }),
      })
      if (!res.ok) throw new Error("mesh push failed: " + res.status)
    },
  }
}
