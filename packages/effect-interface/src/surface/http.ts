import { bindPath, bodyInput, issuesOf, messageOf, queryInput } from "./match.ts"
import type { HttpBinding, Operation } from "./operation.ts"

export interface Failed {
  readonly status: number
  readonly body: unknown
}

export interface HttpSurfaceOptions {
  readonly onError?: (error: unknown) => Failed
}

export const statusOf = (error: unknown): number => {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === "number" && status >= 400 && status < 600 ? status : 500
}

const defaultError = (error: unknown): Failed => {
  const issues = issuesOf(error)
  if (issues !== undefined) return { status: 400, body: { ok: false, error: issues } }
  return { status: statusOf(error), body: { ok: false, error: messageOf(error) } }
}

const sourceOf = (binding: HttpBinding, method: string): "query" | "body" =>
  binding.from ?? (method === "GET" || method === "DELETE" ? "query" : "body")

const rawInput = async (request: Request, url: URL, binding: HttpBinding, bound: Record<string, string>): Promise<Record<string, unknown>> => {
  if (sourceOf(binding, request.method) === "query") return { ...queryInput(url), ...bound }
  const body = await bodyInput(request)
  return binding.bodyField === undefined
    ? { ...body, ...bound }
    : { ...bound, [binding.bodyField]: body }
}

const credentialInput = (request: Request, binding: HttpBinding, raw: Record<string, unknown>): void => {
  const credential = binding.credential
  if (credential === undefined) return
  delete raw[credential.field]
  const header = request.headers.get(credential.header)
  const prefix = credential.prefix ?? ""
  if (header !== null && header.startsWith(prefix)) raw[credential.field] = header.slice(prefix.length)
}

const answer = (value: unknown, binding: HttpBinding): Response => {
  if (value instanceof Response) return value
  const contentType = binding.contentType
  if (contentType !== undefined && typeof value === "string") {
    return new Response(value, { status: binding.status ?? 200, headers: { "content-type": contentType } })
  }
  return Response.json(value, { status: binding.status ?? 200 })
}

export const toHttpHandler = (
  operations: readonly Operation[], options: HttpSurfaceOptions = {},
): ((request: Request) => Promise<Response | undefined>) => {
  const failed = options.onError ?? defaultError
  return async (request) => {
    const url = new URL(request.url)
    for (const op of operations) {
      const binding = op.http
      if (binding === undefined || binding.method !== request.method) continue
      const bound = bindPath(binding.path, url.pathname)
      if (bound === undefined) continue
      try {
        const raw = await rawInput(request, url, binding, bound)
        credentialInput(request, binding, raw)
        return answer(await op.handler(op.input.parse(raw) as never, { request }), binding)
      } catch (error) {
        const { status, body } = failed(error)
        return Response.json(body, { status })
      }
    }
    return undefined
  }
}
