import type { Tunnel } from "@effect-agent/agentd"
import { messageOf } from "@effect-agent/effect-interface"
import { json } from "./http.ts"

const PREFIX = "/agentd/tunnel"

const statusOf = (value: unknown): number => {
  const status = (value as { status?: unknown } | null)?.status
  return typeof status === "number" && status >= 400 && status < 600 ? status : 502
}

export const tunnelRoutes = async (request: Request, url: URL, tunnel: Tunnel): Promise<Response | undefined> => {
  if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) return undefined
  if (url.pathname === PREFIX) {
    if (request.method !== "GET") return new Response(null, { status: 405, headers: { allow: "GET" } })
    return json({
      ok: true,
      upstreams: tunnel.list().map((upstream) => ({ ...upstream, path: `${PREFIX}/${upstream.name}` })),
    })
  }
  const rest = url.pathname.slice(PREFIX.length)
  const cut = rest.indexOf("/", 1)
  const name = decodeURIComponent(cut === -1 ? rest.slice(1) : rest.slice(1, cut))
  const tail = cut === -1 ? "" : rest.slice(cut)
  const bodiless = request.method === "GET" || request.method === "HEAD"
  try {
    return await tunnel.forward(name, `${tail}${url.search}`, {
      method: request.method,
      headers: request.headers,
      ...(bodiless ? {} : { body: request.body }),
    })
  } catch (error) {
    return json({ ok: false, error: messageOf(error) }, statusOf(error))
  }
}
