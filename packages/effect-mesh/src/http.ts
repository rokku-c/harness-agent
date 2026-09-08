/**
 * effect-mesh JSON-RPC HTTP handle.
 *
 * Thin transport wrapper: parse a JSON-RPC envelope and route it through the
 * SAME dispatchMeshJson the memory transport uses — one protocol, many
 * transports.
 */

import type { EffectMesh } from "./mesh.ts"
import { dispatchMeshJson } from "./protocol.ts"

const respond = (id: unknown, result: unknown): Response =>
  Response.json({ jsonrpc: "2.0", id, result })
const respondError = (id: unknown, code: number, message: string): Response =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } })

export const handleMeshHttp =
  (mesh: EffectMesh) =>
  async (request: Request): Promise<Response> => {
    let body: { id?: unknown; method?: string; params?: Record<string, unknown> }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return Response.json({ jsonrpc: "2.0", error: { code: -32700, message: "parse error" } })
    }
    if (typeof body.method !== "string") {
      return respondError(body.id, -32600, "method required")
    }
    const dispatched = await dispatchMeshJson(mesh, body.method, body.params)
    return dispatched.ok ? respond(body.id, dispatched.result) : respondError(body.id, -32000, dispatched.error)
  }
