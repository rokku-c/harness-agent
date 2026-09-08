/**
 * effect-mesh http client — a peer talks to a mesh server over JSON-RPC.
 *
 * Used by a remote node to announce itself (with an endpoint where it can be
 * invoked) and to discover/call peers, and by any caller to reach remote
 * nodes. Server side is handleMeshHttp.
 */

export interface MeshClientOptions {
  readonly url: string
}

export const meshRpc = async (url: string, method: string, params?: unknown): Promise<unknown> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  const payload = (await res.json()) as { result?: unknown; error?: { message?: string } }
  if (payload.error !== undefined) throw new Error("mesh: " + (payload.error.message ?? "error"))
  return payload.result
}

export interface RemoteAnnounce {
  readonly ns: string
  readonly appId: string
  readonly capabilities?: readonly string[]
  /** this peer's own mesh url so the home can call back into it. */
  readonly endpointUrl: string
  /** this peer's push endpoint (host -> node ui/events). */
  readonly eventsUrl?: string
}

export const makeMeshClient = (options: MeshClientOptions) => ({
  announce(remote: RemoteAnnounce): Promise<unknown> {
    return meshRpc(options.url, "mesh/announce", {
      ns: remote.ns,
      appId: remote.appId,
      capabilities: remote.capabilities ?? [],
      endpoint: { url: remote.endpointUrl },
      eventsUrl: remote.eventsUrl,
    })
  },
  discover(ns?: string, capability?: string): Promise<unknown> {
    return meshRpc(options.url, "mesh/discover", { ns, capability })
  },
  call(c: { ns: string; appId: string; tool: string }, args?: unknown, byNamespace?: string): Promise<unknown> {
    return meshRpc(options.url, "mesh/call", { ns: c.ns, appId: c.appId, tool: c.tool, arguments: args, byNamespace })
  },
  grant(fromNs: string, toNs: string): Promise<unknown> {
    return meshRpc(options.url, "mesh/grant", { fromNs, toNs })
  },
})
