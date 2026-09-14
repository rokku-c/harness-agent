import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { baseOf, internalPath } from "./mount.ts"
import { json } from "./helpers.ts"
import { routeState } from "./routes/state.ts"
import { routeMessage } from "./routes/message.ts"
import { routeWorkspace } from "./routes/workspace.ts"
import { routeApprovals } from "./routes/approvals.ts"
import { routeConversation } from "./routes/conversation.ts"

export interface ApiOptions {
  readonly client: Client
  readonly basePath?: string
}

export const makeApiHandler = (options: ApiOptions): (request: Request) => Promise<Response> => {
  const base = baseOf(options.basePath)
  const routes = [routeState, routeMessage, routeWorkspace, routeApprovals, routeConversation]
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    const path = internalPath(url.pathname, base)
    if (path === undefined) return json({ error: "not found" }, 404)
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
