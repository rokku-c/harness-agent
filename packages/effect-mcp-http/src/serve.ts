/**
 * serveMcpHttp — expose a node's MCP server REMOTELY over streamable HTTP from Bun.
 *
 * SDK 1.30 ships a web-standard server transport, so Bun requests are bridged
 * directly (Request -> Response, no express adapter). Every POST is served by a
 * FRESH WebStandardStreamableHTTPServerTransport in stateless JSON mode:
 *
 *   sessionIdGenerator: undefined   -> no sessions, no Mcp-Session-Id header
 *   enableJsonResponse: true        -> JSON-RPC request/response, no SSE stream
 *
 * Stateless transports are single-request: the SDK has enforced that since
 * v1.26 (CVE-2026-25536 — reusing one leaked state between clients), so a new
 * transport is created per request and released afterwards. GET (SSE) is
 * answered 405 so MCP clients fall back to POST-only JSON.
 *
 * Pass a FACTORY to mint a fresh McpServer per request (concurrency-safe for
 * many remote clients). Pass a live McpServer instance to reuse one node server
 * — requests are then serialized through a FIFO because an McpServer may attach
 * to only one transport at a time.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"

export type McpServerSource = McpServer | (() => Promise<McpServer>)
export type McpHttpHandler = (request: Request) => Promise<Response>

export interface ServeMcpHttpOptions {
  /** Forwarded to each transport's `onerror` (SDK parse/transport errors). */
  readonly onerror?: (error: Error) => void
}

const methodNotAllowed = (): Response =>
  new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message: "Method Not Allowed: POST JSON-RPC only (stateless; no SSE stream).",
      },
    }),
    { status: 405, headers: { "Content-Type": "application/json", Allow: "POST" } },
  )

const newTransport = (onerror?: (error: Error) => void): WebStandardStreamableHTTPServerTransport => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  if (onerror !== undefined) transport.onerror = onerror
  return transport
}

export const serveMcpHttp = (source: McpServerSource, options: ServeMcpHttpOptions = {}): McpHttpHandler => {
  const isFactory = typeof source === "function"
  const shared = isFactory ? undefined : (source as McpServer)

  // FIFO for the shared-instance path (one attached transport at a time).
  let tail: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const next = tail.then(task, task)
    tail = next.catch(() => undefined)
    return next
  }

  const serve = async (server: McpServer, request: Request): Promise<Response> => {
    const transport = newTransport(options.onerror)
    try {
      await server.connect(transport)
      return await transport.handleRequest(request)
    } finally {
      // The JSON response body is fully materialized above; detach the transport
      // so the next request can connect a fresh one.
      await server.close().catch(() => undefined)
    }
  }

  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return methodNotAllowed()
    if (isFactory) return serve(await source(), request)
    // Shared instance: drop any connection left by the previous request, then
    // connect a fresh transport and handle, all under the FIFO.
    return serial(async () => {
      await shared!.close().catch(() => undefined)
      return serve(shared!, request)
    })
  }
}
