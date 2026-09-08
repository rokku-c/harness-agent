/**
 * mcp infra plugin — registry-backed MCP surface of the unified server.
 *
 * This is server infrastructure (not owned by a business app), so it is
 * contributed by the composition root rather than by an app. Serves the
 * registry health/catalog under /mcp today; the JSON-RPC gateway mounts onto
 * the same path next.
 */

import type { EffectPlugin } from "@effect-agent/effect-host"
import { makeRegistry, type McpServer } from "@effect-agent/mcp-registry"

export interface McpPluginOptions {
  readonly servers?: readonly McpServer[]
}

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } })

export const makeMcpPlugin = (options: McpPluginOptions = {}): EffectPlugin => ({
  id: "mcp",
  priority: 20,
  load: async () => {
    const registry = makeRegistry()
    for (const server of options.servers ?? []) registry.register(server)
    return {
      canHandle: (path) => path === "/mcp" || path.startsWith("/mcp/"),
      handle: async (request) => {
        const url = new URL(request.url)
        const path = url.pathname
        if (path === "/mcp" || path === "/mcp/health") {
          return json({ ok: true, era: "modern", servers: registry.list().filter((s) => s.status !== "offline").length })
        }
        if (path === "/mcp/servers") return json(registry.list())
        const one = path.match(/^\/mcp\/servers\/([^/]+)$/)
        if (one !== null) {
          const server = registry.get(one[1])
          return server !== undefined ? json(server) : json({ ok: false, detail: "no such server" }, 404)
        }
        if (request.method === "POST") {
          return json({ ok: false, detail: "mcp json-rpc proxy not wired yet" }, 501)
        }
        return json({ ok: false, detail: "not found: " + path }, 404)
      },
    }
  },
})
