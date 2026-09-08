import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { closeAfterStream } from "./stream-response.ts"

export interface McpServerLike { connect(transport: Transport): Promise<void>; close(): Promise<void> }
export type McpServerSource = McpServerLike | (() => Promise<McpServerLike>)
export type McpHttpHandler = (request: Request) => Promise<Response>
export interface ServeMcpHttpOptions {
  readonly onerror?: (error: Error) => void
  readonly authenticate?: (request: Request) => AuthInfo | undefined | Promise<AuthInfo | undefined>
  readonly enableJsonResponse?: boolean
}
const transport = (options: ServeMcpHttpOptions): WebStandardStreamableHTTPServerTransport => {
  const value = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: options.enableJsonResponse ?? true })
  if (options.onerror) value.onerror = options.onerror
  return value
}
const serial = () => {
  let tail: Promise<unknown> = Promise.resolve()
  return async <T>(task: () => Promise<T>): Promise<T> => { const next = tail.then(task, task); tail = next.catch(() => undefined); return next }
}

export const serveMcpHttp = (source: McpServerSource, options: ServeMcpHttpOptions = {}): McpHttpHandler => {
  const shared = typeof source === "function" ? undefined : source
  const queue = serial()
  const serve = async (server: McpServerLike, request: Request): Promise<Response> => {
    if (request.method !== "POST") return Response.json({ error: { message: "POST JSON-RPC only" } }, { status: 405, headers: { allow: "POST" } })
    const current = transport(options)
    const close = async (): Promise<void> => { await server.close().catch(() => undefined) }
    await server.connect(current)
    try {
      const response = await current.handleRequest(request, { authInfo: await options.authenticate?.(request) })
      if (options.enableJsonResponse ?? true) { await close(); return response }
      return closeAfterStream(response, close)
    } catch (error) { await close(); throw error }
  }
  return (request) => shared
    ? queue(() => shared.close().catch(() => undefined).then(() => serve(shared, request)))
    : Promise.resolve(source as () => Promise<McpServerLike>).then((factory) => factory()).then((server) => serve(server, request))
}
