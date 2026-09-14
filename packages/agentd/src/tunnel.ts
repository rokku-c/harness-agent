import { AgentdError } from "./errors.ts"

export interface TunnelUpstream {
  readonly name: string
  readonly url: string
}

export type TunnelSend = (input: string, init?: RequestInit) => Promise<Response>

export interface TunnelOptions {
  readonly upstreams: readonly TunnelUpstream[]
  readonly send?: TunnelSend
}

export interface Tunnel {
  readonly list: () => readonly TunnelUpstream[]
  readonly forward: (name: string, rest: string, init: RequestInit) => Promise<Response>
}

const join = (base: string, rest: string): string => base.replace(/\/+$/, "") + (rest.startsWith("/") ? rest : `/${rest}`)

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
