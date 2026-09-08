import { invoke } from "@effect-agent/effect-interface"
import type { MeshCall, MeshDiscover, MeshEntry, MeshOptions } from "./types"
import { toolKey } from "./types"

export const discover = (nodes: Map<string, MeshEntry>, q: MeshDiscover) => [...nodes.entries()]
  .filter(([, e]) => q.ns === undefined || e.announce.ns === q.ns)
  .filter(([, e]) => q.capability === undefined || (e.announce.capabilities ?? []).includes(q.capability))
  .map(([key, e]) => ({ key, ns: e.announce.ns, appId: e.announce.appId, capabilities: e.announce.capabilities ?? [] }))

export const callNode = async (nodes: Map<string, MeshEntry>, options: MeshOptions, c: MeshCall, args: unknown, callerNs: string) => {
  const key = `${c.ns}::${c.appId}`, node = nodes.get(key)
  if (!node) throw new Error("mesh: no node " + key)
  await options.onCall?.({ ns: c.ns, appId: c.appId, tool: c.tool, args, byNamespace: callerNs })
  if (node.remote) return node.remote(c, args, { byNamespace: callerNs })
  if (node.endpoint) return remoteCall(node.endpoint.url, c, args, callerNs)
  if (!node.registry) throw new Error("mesh: node " + key + " has no local registry (protocol node)")
  const tool = node.registry.tools().find((t) => t.key === toolKey(c.ns, c.appId, c.tool))
  if (!tool) throw new Error("mesh: unknown tool " + toolKey(c.ns, c.appId, c.tool))
  return invoke(tool.tool, args)
}

const remoteCall = async (url: string, c: MeshCall, args: unknown, byNamespace: string) => {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "mesh/call", params: { ...c, arguments: args, byNamespace } }) })
  const payload = await res.json() as { result?: unknown; error?: { message?: string } }
  if (payload.error) throw new Error("mesh remote: " + (payload.error.message ?? "error"))
  return payload.result
}
