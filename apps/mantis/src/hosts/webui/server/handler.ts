import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { json, readAsset } from "./helpers.ts"
import { routeState } from "./routes/state.ts"
import { routeMessage } from "./routes/message.ts"
import { routeWorkspace } from "./routes/workspace.ts"
import { routeApprovals } from "./routes/approvals.ts"
import { routeConversation } from "./routes/conversation.ts"

export interface ConsoleHandlerOptions {
  readonly client: Client
  readonly publicDir: string
  /** Host path prefix, for example "/mantis". Empty means root-mounted. */
  readonly basePath?: string
}

const ASSETS: ReadonlyArray<[string, string, string]> = [
  ["/", "index.html", "text/html; charset=utf-8"],
  ["/app-shell.js", "app-shell.js", "text/javascript"],
  ["/app-shell.css", "app-shell.css", "text/css"],
  ["/style.css", "style.css", "text/css"],
]

const baseOf = (value: string | undefined): string => value === undefined || value === "/" ? "" : "/" + value.replace(/^\/+|\/+$/g, "")
const internalPath = (path: string, base: string): string | undefined => base === "" || path === base
  ? base === "" ? path : "/"
  : path.startsWith(base + "/") ? path.slice(base.length) : undefined
const prefix = (body: string, base: string, name: string, kind: "href" | "src"): string =>
  base === "" ? body : body.replaceAll(`${kind}="${name}"`, `${kind}="${base}${name}"`)
const prefixApi = (body: string, base: string): string => base === ""
  ? body
  : body.replaceAll('"/api/', `"${base}/api/`).replaceAll("'/api/", `'${base}/api/`)

export const makeConsoleHandler = (options: ConsoleHandlerOptions) => {
  const base = baseOf(options.basePath)
  const routes = [routeState, routeMessage, routeWorkspace, routeApprovals, routeConversation]
  return async (request: Request): Promise<Response> => {
    const incoming = new URL(request.url)
    const path = internalPath(incoming.pathname, base)
    if (path === undefined) return json({ error: "not found" }, 404)
    if (request.method === "GET") {
      const asset = ASSETS.find(([p]) => p === path)
      if (asset !== undefined) {
        const body = readAsset(options.publicDir, asset[1])
        if (body === undefined) return json({ error: "asset not found" }, 404)
        const rewritten = asset[1] === "index.html"
          ? prefix(prefix(prefix(body, base, "/app-shell.css", "href"), base, "/style.css", "href"), base, "/app-shell.js", "src")
          : asset[1] === "app-shell.js" ? prefixApi(body, base) : body
        return new Response(rewritten, { headers: { "Content-Type": asset[2] } })
      }
    }
    const url = new URL(request.url)
    url.pathname = path
    try {
      for (const route of routes) {
        const response = await route(url, request, options.client)
        if (response !== undefined) return response
      }
      return json({ error: "not found" }, 404)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500)
    }
  }
}
