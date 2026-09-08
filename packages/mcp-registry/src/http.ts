import type { McpServer } from "./contract.ts"
import type { Registry } from "./store.ts"

export interface RegistryHttpOptions { tokenFor?(serverId: string): string | undefined }
const json = (value: unknown, status = 200) => Response.json(value, { status })
const token = (request: Request): string | undefined => {
  const value = request.headers.get("authorization")
  return value?.startsWith("Bearer ") ? value.slice(7) : undefined
}
const failure = (error: unknown): Response => json({ ok: false, error: error instanceof Error ? error.message : "registry request failed" }, 400)
export const makeRegistryHandler = (registry: Registry, options: RegistryHttpOptions = {}) => async (request: Request): Promise<Response> => {
  const url = new URL(request.url), path = url.pathname
  try {
    if (request.method === "GET" && path === "/-/registry/servers") return json({ servers: registry.list() })
    const auth = token(request)
    if (!auth) return json({ ok: false, error: "registry authorization required" }, 401)
    if (request.method === "POST" && path === "/-/registry/announce") {
      const server = await request.json() as McpServer
      if (options.tokenFor && options.tokenFor(server.serverId) !== auth) return json({ ok: false, error: "unauthorized" }, 401)
      return json(registry.announce(server, auth), 201)
    }
    if (request.method === "POST" && path === "/-/registry/heartbeat") {
      const body = await request.json() as { serverId?: string; at?: number }
      return registry.heartbeat(body.serverId ?? "", auth, body.at) ? json({ ok: true }) : json({ ok: false, error: "unknown or unauthorized server" }, 403)
    }
    const match = path.match(/^\/-\/registry\/([^/]+)$/)
    if (request.method === "DELETE" && match) return registry.withdraw(decodeURIComponent(match[1]), auth) ? new Response(null, { status: 204 }) : json({ ok: false, error: "unknown or unauthorized server" }, 403)
    return json({ ok: false, error: "not found" }, 404)
  } catch (error) { return failure(error) }
}
