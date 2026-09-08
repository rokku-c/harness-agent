import type { GatewayUpstream } from "@effect-agent/ai-gateway"
import type { GatewayProvider } from "./providers.ts"
import { upstreamHeaders } from "./upstream-headers.ts"
import { upstreamURL } from "./upstream-url.ts"

export type HttpSend = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export const httpUpstream = (provider: GatewayProvider, send: HttpSend = fetch): GatewayUpstream => ({
  send: (request) => send(new Request(upstreamURL(provider.baseURL, new URL(request.url)).toString(), {
    method: request.method,
    headers: upstreamHeaders(request.headers, provider),
    body: request.body,
    redirect: "manual",
  })),
})
