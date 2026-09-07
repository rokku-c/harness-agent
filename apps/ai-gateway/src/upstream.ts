import type { GatewayUpstream } from "@effect-agent/ai-gateway"

export const httpUpstream = (baseURL: string, apiKey?: string, send: typeof fetch = fetch): GatewayUpstream => ({
  send: (request) => {
    const source = new URL(request.url)
    const target = new URL(source.pathname + source.search, baseURL.endsWith("/") ? baseURL : baseURL + "/")
    const headers = new Headers(request.headers)
    headers.delete("host")
    headers.delete("content-length")
    headers.delete("x-agent-id")
    headers.delete("x-session-id")
    if (apiKey !== undefined) headers.set("authorization", "Bearer " + apiKey)
    return send(new Request(target, { method: request.method, headers, body: request.body }))
  }
})
