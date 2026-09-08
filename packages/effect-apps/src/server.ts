/**
 * buildAppsMcpServer — one MCP entry to browse and operate every app in a catalog.
 * Tools: apps_list (summary rows), app_read ({ns,appId,part,key?} -> ui doc/state,
 * config, or store value), app_call ({ns,appId,tool,arguments} -> invoke a registry
 * tool). Plane reads/calls pass the entry's authorize(op) gate; a denial throws
 * (surfaced by the MCP SDK as an isError result).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { invokeAppTool } from "./tools.ts"
import { requireAppPlane } from "./access.ts"
import type { AppCatalog, AppEntry } from "./catalog.ts"
import { appKey, summarize } from "./catalog.ts"

type AppPart = "ui" | "state" | "config" | "store"
type TextResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean }

const fail = (message: string): never => { throw new Error(message) }
const ok = (value: unknown): TextResult => ({ content: [{ type: "text", text: JSON.stringify(value) ?? "null" }] })

const readArgs = z.object({ ns: z.string(), appId: z.string(), part: z.enum(["ui", "state", "config", "store"]), key: z.string().optional() })
const callArgs = z.object({ ns: z.string(), appId: z.string(), tool: z.string(), arguments: z.record(z.string(), z.unknown()).optional() })

const entry = (catalog: AppCatalog, ns: string, appId: string): AppEntry =>
  catalog.find(ns, appId) ?? fail(`effect-apps: no app ${appKey(ns, appId)}`)

/** Read one plane. ui and state both sit behind the "ui" op. */
const readPlane = async (app: AppEntry, part: AppPart, key?: string): Promise<unknown> => {
  switch (part) {
    case "ui":
      return app.ui?.doc ? app.ui.doc() : null
    case "state": {
      const s = app.ui?.state ? app.ui.state() : null
      return s instanceof Promise ? await s : s
    }
    case "config": {
      const c = app.config
      return c === undefined ? null : { ...(c.schema ? { schema: c.schema() } : {}), ...(c.value ? { value: c.value() } : {}), ...(c.sources ? { sources: c.sources() } : {}) }
    }
    case "store": {
      const s = app.store
      return s === undefined ? null : key !== undefined ? (s.get(key) ?? null) : Object.fromEntries(s.list().map((k) => [k, s.get(k)]))
    }
  }
}

export const buildAppsMcpServer = (catalog: AppCatalog): McpServer => {
  const server = new McpServer({ name: "effect-apps", version: "0.1.0" })
  const register = server.registerTool.bind(server) as unknown as (
    name: string,
    config: { title?: string; description?: string; inputSchema?: unknown },
    handler: (args: Record<string, unknown>) => Promise<TextResult>,
  ) => void

  register("apps_list", { title: "Apps list", description: "List every registered effect app and the planes it exposes." },
    async () => ok(catalog.list().map(summarize)
      .filter((app) => app.hasInterface || app.hasUi || app.hasConfig || app.hasStore)))

  register("app_read", { title: "App read", description: "Read one plane of an app: ui doc, ui state, config, or store value at key.", inputSchema: readArgs.shape },
    async (args) => {
      const { ns, appId, part, key } = args as z.infer<typeof readArgs>
      const app = entry(catalog, ns, appId)
      requireAppPlane(app, part === "state" ? "ui" : part)
      return ok(await readPlane(app, part, key))
    })

  register("app_call", { title: "App call", description: "Run one tool of an app's effect-interface registry and return its parsed result.", inputSchema: callArgs.shape },
    async (args) => {
      const { ns, appId, tool: name, arguments: raw } = args as z.infer<typeof callArgs>
      const app = entry(catalog, ns, appId)
      return ok(await invokeAppTool(app, name, raw ?? {}))
    })

  return server
}
