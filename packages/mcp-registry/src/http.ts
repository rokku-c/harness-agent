import type { Registry } from "./store.ts"
import { announceSchema, heartbeatSchema } from "./http-validation.ts"

const fail = (status: number, error: string) => Response.json({ ok: false, error }, { status })
/** HTTP validates requests; the shared registry is the sole authority for credentials. */
export const makeRegistryHandler = (registry: Registry) => async (request: Request): Promise<Response> => {
  const path = new URL(request.url).pathname
  if (request.method === "GET" && path === "/-/registry/servers") return Response.json({ servers: registry.list() })
  const action = path === "/-/registry/announce" ? "announce" : path === "/-/registry/heartbeat" ? "heartbeat" : undefined
  const deletion = path.match(/^\/-\/registry\/([^/]+)$/)
  if (!action && !(request.method === "DELETE" && deletion)) return fail(404, "unknown registry route")
  if (action && request.method !== "POST") return fail(405, "POST required")
  const header = request.headers.get("authorization")
  if (!header?.startsWith("Bearer ") || !header.slice(7).trim()) return fail(401, "registry authorization required")
  const token = header.slice(7)
  if (!action && deletion) {
    let id: string
    try { id = decodeURIComponent(deletion[1]) } catch { return fail(400, "invalid server id") }
    if (!registry.get(id)) return fail(404, "server not found")
    return registry.withdraw(id, token) ? new Response(null, { status: 204 }) : fail(403, "unauthorized registry operation")
  }
  let body: unknown
  try { body = await request.json() } catch { return fail(400, "invalid JSON") }
  if (action === "heartbeat") {
    const parsed = heartbeatSchema.safeParse(body)
    if (!parsed.success) return fail(400, "expected {serverId}; heartbeat time is set by the server")
    if (!registry.get(parsed.data.serverId)) return fail(404, "server not found")
    return registry.heartbeat(parsed.data.serverId, token) ? Response.json({ ok: true }) : fail(403, "unauthorized registry operation")
  }
  const parsed = announceSchema.safeParse(body)
  if (!parsed.success) return fail(400, "invalid server declaration")
  const existed = !!registry.get(parsed.data.serverId)
  try { return Response.json(registry.announce(parsed.data, token), { status: existed ? 200 : 201 }) }
  catch { return fail(403, "unauthorized registry operation") }
}
