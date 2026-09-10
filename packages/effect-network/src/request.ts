import { EgressError } from "./types.ts"
import { targetHeaders } from "./headers.ts"

export const targetURL = (input: string): URL => {
  let url: URL
  try { url = new URL(input) } catch { throw new EgressError(400, "Invalid egress URL") }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new EgressError(400, "Egress requires an HTTP(S) URL without credentials or fragment")
  }
  return url
}
const requestInput = (input: string | URL | Request, init?: RequestInit): Request =>
  input instanceof Request
    ? new Request(input, init)
    : new Request(input instanceof URL ? input.href : input, init)

export const targetRequest = (input: string | URL | Request, init?: RequestInit): Request => {
  const request = requestInput(input, init)
  const url = targetURL(request.url)
  return new Request(url.href, { method: request.method, headers: targetHeaders(request.headers), redirect: "manual",
    signal: request.signal, ...(!["GET", "HEAD"].includes(request.method) ? { body: request.body } : {}),
  })
}
