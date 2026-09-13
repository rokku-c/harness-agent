/**
 * server/serve.ts - the HTTP SHELL.
 *
 * Concept: a thin Bun.serve translator - static panel assets on GET, every
 * /api call delegated to the per-family route modules (state/events, chat,
 * approvals, workspace, conversation), and NOTHING else touches the
 * backend: the SSE stream polls mantis_events so live updates flow through
 * MCP too. Failures answer 500 with the readable cause.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { makeConsoleHandler } from "./handler.ts"

export interface ServeOptions {
  /** the in-process MCP client (connected to the mantis MCP server) */
  readonly client: Client
  readonly publicDir: string
  readonly host?: string
  readonly port?: number
}

export const serveConsole = (options: ServeOptions): { url: string; stop: () => void } => {
  const { client, publicDir } = options
  const host = options.host ?? "127.0.0.1"
  const port = options.port ?? 3737
  const handle = makeConsoleHandler({ client, publicDir })

  const server = Bun.serve({
    hostname: host,
    port,
    fetch: handle
  })
  const url = "http://" + host + ":" + server.port
  return { url, stop: () => server.stop(true) }
}
