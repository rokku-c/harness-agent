import type { EffectPlugin } from "@effect-agent/effect-host"
import type { ConfigRegistry } from "@effect-agent/effect-config"

/** Read-only configuration surface; initialization happens once, never as an overlay. */
export const makeConfigPlugin = (
  configs: ConfigRegistry, yamlOf?: (id: string) => unknown, overrideOf?: (id: string) => unknown,
): EffectPlugin => ({
  id: "config", priority: 150,
  load: async () => ({
    canHandle: (path) => path === "/-/config" || path.startsWith("/-/config/"),
    handle: async (request) => {
      if (request.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } })
      const path = new URL(request.url).pathname
      if (path === "/-/config") return Response.json(configs.list().map((d) => ({
        appId: d.appId, title: d.title ?? d.appId, description: d.description, schema: configs.schemaFor(d.appId),
      })))
      const id = decodeURIComponent(path.slice("/-/config/".length))
      const schema = configs.schemaFor(id)
      if (!schema) return Response.json({ ok: false, detail: `No config declared: ${id}` }, { status: 404 })
      const out = configs.initialize(id, { yaml: yamlOf?.(id), override: overrideOf?.(id) })
      return Response.json({ ...out, schema }, { status: out.ok ? 200 : 400 })
    },
  }),
})
