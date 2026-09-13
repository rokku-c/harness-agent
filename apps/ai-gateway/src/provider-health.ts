import { messageOf } from "@effect-agent/effect-interface"
import type { GatewayProvider } from "./providers.ts"
import { upstreamHeaders } from "./upstream-headers.ts"
import type { HttpSend } from "./upstream.ts"

export interface ProviderHealth {
  readonly providerId: string
  readonly reachable: boolean
  readonly status?: number
  readonly durationMs: number
  readonly error?: string
}

/** A live reachability probe through the same platform egress the proxy uses. */
export const checkProvider = async (provider: GatewayProvider, send: HttpSend): Promise<ProviderHealth> => {
  const started = performance.now()
  try {
    const response = await send(new Request(provider.baseURL, {
      method: "GET", headers: upstreamHeaders(new Headers(), provider), redirect: "manual",
    }))
    return {
      providerId: provider.id, reachable: true, status: response.status,
      durationMs: Math.round(performance.now() - started),
    }
  } catch (error) {
    return {
      providerId: provider.id, reachable: false, durationMs: Math.round(performance.now() - started),
      error: messageOf(error),
    }
  }
}
