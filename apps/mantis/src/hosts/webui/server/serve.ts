/**
 * server/serve.ts - the HTTP SHELL, and the one place the standalone host's
 * surface is declared: the panel's own files first, the call surface behind
 * them.
 *
 * Concept: a thin Bun.serve wrapper. A host that must not serve the panel -
 * the embedded app, whose UI the platform console renders from the
 * declarative view - takes makeApiHandler from api.ts directly instead.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { makeApiHandler } from "./api.ts"
import { panelAsset } from "./assets.ts"

export interface ServeOptions {
  /** the in-process MCP client (connected to the mantis MCP server) */
  readonly client: Client
  readonly publicDir: string
  readonly basePath?: string
  readonly host?: string
  readonly port?: number
}

export const serveConsole = (options: ServeOptions): { url: string; stop: () => void } => {
  const host = options.host ?? "127.0.0.1"
  const port = options.port ?? 3737
  const api = makeApiHandler({ client: options.client, basePath: options.basePath })
  const handle = async (request: Request): Promise<Response> =>
    panelAsset(options, request) ?? await api(request)

  const server = Bun.serve({
    hostname: host,
    port,
    fetch: handle
  })
  const url = "http://" + host + ":" + server.port
  return { url, stop: () => server.stop(true) }
}
