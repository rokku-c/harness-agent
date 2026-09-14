/**
 * server/serve.ts - the standalone HTTP SHELL: Bun.serve over the call surface.
 *
 * Concept: a thin Bun.serve wrapper around api.ts, and the one place the
 * standalone host's surface is declared. That surface is the HTTP API and
 * nothing else - the browser cannot speak MCP stdio, so a request becomes a call
 * on the in-process mantis MCP server. A host that must not listen at all - the
 * embedded app - takes makeApiHandler from api.ts directly instead.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { makeApiHandler } from "./api.ts"

export interface ServeOptions {
  /** the in-process MCP client (connected to the mantis MCP server) */
  readonly client: Client
  /** host path prefix, for example "/mantis". Absent means root-mounted. */
  readonly basePath?: string
  readonly host?: string
  readonly port?: number
}

export const serveConsole = (options: ServeOptions): { url: string; stop: () => void } => {
  const host = options.host ?? "127.0.0.1"
  const port = options.port ?? 3737
  const api = makeApiHandler({ client: options.client, basePath: options.basePath })

  const server = Bun.serve({
    hostname: host,
    port,
    fetch: api
  })
  const url = "http://" + host + ":" + server.port
  return { url, stop: () => server.stop(true) }
}
