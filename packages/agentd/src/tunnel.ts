import { AgentdError } from "./errors.ts"

/**
 * The tunnel. Agents on this machine are configured to talk to one local
 * address, and where that traffic actually goes is the platform's decision,
 * made by egress policy: on a peer it leaves through the main node's gateway,
 * which is the one holding the provider credentials and the MCP servers, and on
 * the main node itself the same address is answered locally. Configuration that
 * never names the main node is configuration that does not change when a
 * machine's role does.
 *
 * A tunnel is therefore not a proxy with its own rules. It resolves a name to a
 * target and hands the request to the egress-bound send it was given, so the
 * policy, the credentials and the audit stay in one place — the platform's.
 */
export interface TunnelUpstream {
  /** One path segment: this upstream is served to agents at `/agentd/tunnel/<name>`. */
  readonly name: string
  /** The address this name resolves to, reached from wherever the egress puts it. */
  readonly url: string
}

/** The platform's egress-bound send. Declared structurally: this package owns no network. */
export type TunnelSend = (input: string, init?: RequestInit) => Promise<Response>

export interface TunnelOptions {
  readonly upstreams: readonly TunnelUpstream[]
  /** Absent = the platform did not wire egress, and every forward says so instead of going out ungoverned. */
  readonly send?: TunnelSend
}

export interface Tunnel {
  readonly list: () => readonly TunnelUpstream[]
  readonly forward: (name: string, rest: string, init: RequestInit) => Promise<Response>
}

/** `mcp` plus `/sse` is one address, and a target written with a trailing slash still is. */
const join = (base: string, rest: string): string => base.replace(/\/+$/, "") + (rest.startsWith("/") ? rest : `/${rest}`)

/**
 * Names and targets are checked when the tunnel is built rather than when a
 * request arrives: a duplicate name would silently make one upstream
 * unreachable, and a relative target would fail once per request with an error
 * that blames the request.
 */
const validate = (upstreams: readonly TunnelUpstream[]): void => {
  const seen = new Set<string>()
  for (const upstream of upstreams) {
    if (upstream.name === "" || upstream.name.includes("/")) {
      throw new AgentdError(400, `A tunnel name is one path segment; got "${upstream.name}"`)
    }
    if (seen.has(upstream.name)) throw new AgentdError(400, `Tunnel name "${upstream.name}" is declared twice`)
    seen.add(upstream.name)
    let url: URL
    try { url = new URL(upstream.url) } catch { throw new AgentdError(400, `Tunnel "${upstream.name}" needs an absolute http(s) url, got "${upstream.url}"`) }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new AgentdError(400, `Tunnel "${upstream.name}" needs an http(s) url, got "${upstream.url}"`)
    }
  }
}

export const makeTunnel = (options: TunnelOptions): Tunnel => {
  validate(options.upstreams)
  const byName = new Map(options.upstreams.map((upstream) => [upstream.name, upstream]))
  return {
    list: () => [...byName.values()],
    forward: async (name, rest, init) => {
      const upstream = byName.get(name)
      if (upstream === undefined) {
        const known = [...byName.keys()].join(", ")
        throw new AgentdError(404, `No tunnel named "${name}"; this machine tunnels ${known || "nothing"}`)
      }
      const { send } = options
      if (send === undefined) {
        throw new AgentdError(503, "agentd has no platform egress, so it cannot tunnel; the platform wires it at registration")
      }
      return await send(join(upstream.url, rest), init)
    },
  }
}
