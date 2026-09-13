import type { Tunnel } from "@effect-agent/agentd"
import { messageOf } from "@effect-agent/effect-interface"
import { json } from "./http.ts"

const PREFIX = "/agentd/tunnel"

/**
 * A forward that failed carries the status its own layer gave it — "no available
 * egress for policy main-first" is a 503 about this machine's policy, and
 * reporting it as a 500 would blame the agent. Anything with no status of its
 * own failed on the wire, which is a 502: the tunnel is the gateway here, and
 * the gateway could not reach what it was asked for.
 */
const statusOf = (value: unknown): number => {
  const status = (value as { status?: unknown } | null)?.status
  return typeof status === "number" && status >= 400 && status < 600 ? status : 502
}

/**
 * The local face of the tunnel. Everything an agent here needs is under one
 * path prefix, so a machine's agents see a single address and never a main
 * node: what is behind it is chosen by egress policy, not by the caller.
 *
 * Nothing is rewritten on the way through — method, headers, body and query
 * travel as they arrived, because a tunnel that edited the request would be a
 * second, quieter answer to what the caller asked for.
 */
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
