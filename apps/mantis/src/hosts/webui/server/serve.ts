/**
 * server/serve.ts - the HTTP SHELL.
 *
 * Concept: a thin Bun.serve translator - static panel assets on GET, every
 * /api call delegated to the per-family route modules (state/events, chat,
 * approvals, workspace, ui, conversation), and NOTHING else touches the
 * backend: the SSE stream polls mantis_events so live updates flow through
 * MCP too. Failures answer 500 with the readable cause.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { json, readAsset } from "./helpers.ts"
import { routeState } from "./routes/state.ts"
import { routeMessage } from "./routes/message.ts"
import { routeWorkspace } from "./routes/workspace.ts"
import { routeUi } from "./routes/ui.ts"
import { routeApprovals } from "./routes/approvals.ts"
import { routeConversation } from "./routes/conversation.ts"

export interface ServeOptions {
  /** the in-process MCP client (connected to the mantis MCP server) */
  readonly client: Client
  readonly publicDir: string
  readonly host?: string
  readonly port?: number
}

const ASSETS: ReadonlyArray<[string, string, string]> = [
  ["/", "index.html", "text/html; charset=utf-8"],
  ["/app-shell.js", "app-shell.js", "text/javascript"],
  ["/app-shell.css", "app-shell.css", "text/css"],
  ["/style.css", "style.css", "text/css"]
]

export const serveConsole = (options: ServeOptions): { url: string; stop: () => void } => {
  const { client, publicDir } = options
  const host = options.host ?? "127.0.0.1"
  const port = options.port ?? 3737

  const server = Bun.serve({
    hostname: host,
    port,
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url)
      const path = url.pathname
      if (request.method === "GET") {
        const asset = ASSETS.find(([p]) => p === path)
        if (asset !== undefined) {
          const body = readAsset(publicDir, asset[1])
          if (body === undefined) return json({ error: "asset not found" }, 404)
          return new Response(body, { headers: { "Content-Type": asset[2] } })
        }
      }
      try {
        const routes = [routeState, routeMessage, routeWorkspace, routeUi, routeApprovals, routeConversation]
        for (const route of routes) {
          const response = await route(url, request, client)
          if (response !== undefined) return response
        }
        return json({ error: "not found" }, 404)
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, 500)
      }
    }
  })
  const url = "http://" + host + ":" + server.port
  return { url, stop: () => server.stop(true) }
}
