import { createHash, timingSafeEqual } from "node:crypto"
import { EgressError, type EgressOptions, type EgressPolicy } from "./types.ts"
import { targetURL } from "./request.ts"
import { targetHeaders } from "./headers.ts"

const equal = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest())
const decodeHeaders = (raw: string): Headers => {
  if (raw.length > 32768) throw new EgressError(400, "Egress headers exceed limit")
  let value: unknown
  try { value = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) } catch { throw new EgressError(400, "Invalid target headers") }
  if (!Array.isArray(value) || value.some((v) => !Array.isArray(v) || v.length !== 2 || v.some((s) => typeof s !== "string"))) {
    throw new EgressError(400, "Invalid target headers")
  }
  try { return targetHeaders(new Headers(value as [string, string][])) }
  catch { throw new EgressError(400, "Invalid target headers") }
}
export const serveRelay = async (
  options: EgressOptions, policyFor: (id: string) => EgressPolicy | undefined, request: Request,
): Promise<Response> => {
  try {
    if (new URL(request.url).pathname !== "/-/network/egress") throw new EgressError(404, "Unknown network route")
    if (options.role !== "main" || !options.relayToken) throw new EgressError(503, "Main-node relay is not enabled")
    if (!equal(request.headers.get("authorization") ?? "", `Bearer ${options.relayToken}`)) throw new EgressError(401, "Invalid relay identity")
    const policy = policyFor(request.headers.get("x-effect-app") ?? "")
    if (!policy || policy === "local-only") throw new EgressError(403, "App is not permitted to use this main-node relay")
    if (options.localAvailable === false) throw new EgressError(503, "Main-node exit is unavailable")
    const url = targetURL(request.headers.get("x-effect-target-url") ?? "")
    const headers = decodeHeaders(request.headers.get("x-effect-target-headers") ?? "")
    return await (options.localSend ?? fetch)(new Request(url.href, { method: request.method, headers,
      redirect: "manual", signal: request.signal,
      ...(!["GET", "HEAD"].includes(request.method) ? { body: request.body } : {}),
    }))
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof EgressError ? error.message : "Main-node egress failed" },
      { status: error instanceof EgressError ? error.status : 502 })
  }
}
