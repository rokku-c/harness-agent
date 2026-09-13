/**
 * buildAppsMcpServer — one MCP entry to browse and operate every app in a catalog.
 * Tools: apps_list (summary rows), app_read ({ns,appId,part,key?} -> ui doc/state,
 * config, or store value), app_call ({ns,appId,tool,arguments} -> a registry tool),
 * app_reload ({ns,appId} -> re-read that app's code from source in place). Plane
 * reads and calls pass the entry's authorize(op) gate; a denial throws, which the
 * MCP SDK surfaces as an isError result. A refusal to reload throws too: "unchanged
 * and still serving" is a result on the control plane, where 200 is right, and an
 * error here, where a caller asked for a reload and did not get one.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { invokeAppTool } from "./tools.ts"
import { requireAppPlane } from "./access.ts"
import { appKey, summarize, type AppCatalog, type AppEntry } from "./catalog.ts"
import type { HostReloadResult } from "@effect-agent/effect-host"

type AppPart = "ui" | "state" | "config" | "store"
type TextResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean }

const fail = (message: string): never => { throw new Error(message) }
const ok = (value: unknown): TextResult => ({ content: [{ type: "text", text: JSON.stringify(value) ?? "null" }] })

const readArgs = z.object({ ns: z.string(), appId: z.string(), part: z.enum(["ui", "state", "config", "store"]), key: z.string().optional() })
const callArgs = z.object({ ns: z.string(), appId: z.string(), tool: z.string(), arguments: z.record(z.string(), z.unknown()).optional() })
const reloadArgs = z.object({ ns: z.string(), appId: z.string() })

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

export interface AppsMcpOptions {
  /**
   * Re-read one app's code from source (§6.4). Absent on a host that does not own
   * app sources — and then app_reload says so rather than reporting a reload that
   * never happened.
   */
  readonly reload?: (appId: string) => Promise<HostReloadResult>
}

export const buildAppsMcpServer = (catalog: AppCatalog, options: AppsMcpOptions = {}): McpServer => {
  const server = new McpServer({ name: "effect-apps", version: "0.1.0" })
  const register = server.registerTool.bind(server) as unknown as (name: string,
    config: { title?: string; description?: string; inputSchema?: unknown },
    handler: (args: Record<string, unknown>) => Promise<TextResult>) => void

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

  register("app_reload", { title: "App reload", description: "Re-read one app's code from source and serve it in place, without restarting the host.", inputSchema: reloadArgs.shape },
    async (args) => {
      const { ns, appId } = args as z.infer<typeof reloadArgs>
      const app = entry(catalog, ns, appId)
      const reload = options.reload ?? fail("effect-apps: this host does not own app sources")
      const outcome = await reload(app.appId)
      if (!outcome.ok) {
        fail(`effect-apps: reload of ${app.appId} did not happen (${outcome.reason ?? "failed"})`
          + `; the generation already serving is still serving`)
      }
      return ok(outcome)
    })

  return server
}
