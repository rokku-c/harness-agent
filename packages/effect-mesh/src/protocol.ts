/**
 * Shared JSON-RPC dispatch — the ONE protocol message path.
 *
 * HTTP (handleMeshHttp), memory (connectNodeViaMemory) and later ws all route
 * through dispatchMeshJson, so home↔node communication is protocol-uniform
 * (audit/isolation happen on the home before dispatch returns).
 */

import { makeEffectRegistry } from "@effect-agent/effect-interface"
import type { EffectMesh } from "./mesh.ts"

export type DispatchResult = { ok: true; result?: unknown } | { ok: false; error: string }

export const dispatchMeshJson = async (
  mesh: EffectMesh,
  method: string,
  params: Record<string, unknown> | undefined,
): Promise<DispatchResult> => {
  try {
    switch (method) {
      case "mesh/list":
        return { ok: true, result: mesh.list() }
      case "mesh/discover": {
        const q = params ?? {}
        return { ok: true, result: mesh.discover({ ns: q.ns as string | undefined, capability: q.capability as string | undefined }) }
      }
      case "mesh/grant": {
        mesh.grant(String(params?.fromNs ?? ""), String(params?.toNs ?? ""))
        return { ok: true, result: { ok: true } }
      }
      case "mesh/announce": {
        const ns = String(params?.ns ?? "")
        const appId = String(params?.appId ?? "")
        if (ns === "" || appId === "") return { ok: false, error: "ns and appId required" }
        const ep = params?.endpoint as { url?: string } | undefined
        const eventsUrl = typeof params?.eventsUrl === "string" ? (params.eventsUrl as string) : undefined
        mesh.announce({
          ns,
          appId,
          registry: makeEffectRegistry(),
          capabilities: Array.isArray(params?.capabilities) ? (params?.capabilities as string[]) : [],
          ...(ep?.url !== undefined ? { endpoint: { url: ep.url } } : {}),
          ...(eventsUrl !== undefined ? { eventsUrl } : {}),
        })
        return { ok: true, result: { ok: true, key: `${ns}::${appId}` } }
      }
      case "mesh/call": {
        const p = params ?? {}
        const result = await mesh.call(
          { ns: String(p.ns ?? ""), appId: String(p.appId ?? ""), tool: String(p.tool ?? "") },
          p.arguments,
          { byNamespace: p.byNamespace as string | undefined },
        )
        return { ok: true, result }
      }
      case "mesh/push": {
        const p = params ?? {}
        await mesh.push({ ns: String(p.ns ?? ""), appId: String(p.appId ?? "") }, p.payload)
        return { ok: true, result: { ok: true } }
      }
      default:
        return { ok: false, error: "method not found: " + method }
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** connect a same-process node to a home THROUGH the protocol (memory). */
export const connectNodeViaMemory = (
  home: EffectMesh,
  node: EffectMesh,
  announce: { ns: string; appId: string; capabilities?: readonly string[] },
): (() => void) => {
  const remote = async (
    c: { ns: string; appId: string; tool: string },
    args: unknown,
    opt?: { byNamespace?: string },
  ): Promise<unknown> => {
    // serialized envelope — home never touches the node's registry
    const serialized = JSON.parse(JSON.stringify(args ?? {}))
    const result = await dispatchMeshJson(node, "mesh/call", {
      ns: c.ns,
      appId: c.appId,
      tool: c.tool,
      arguments: serialized,
      byNamespace: opt?.byNamespace ?? c.ns,
    })
    if (!result.ok) throw new Error(result.error)
    return result.result
  }
  return home.announce({
    ns: announce.ns,
    appId: announce.appId,
    capabilities: announce.capabilities ?? [],
    remote,
  })
}
