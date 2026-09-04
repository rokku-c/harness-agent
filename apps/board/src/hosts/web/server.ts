/**
 * Board web host: a thin HTTP shell whose backend IS the board MCP server.
 * Every /api call is one client.callTool over an in-process transport; the
 * page polls board_events for the live feed, so there is no push state to
 * keep. The panel is a built bundle served from ./public (bun run build:web).
 */
import { Effect } from "effect"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"

export interface BoardWebOptions {
  /** the board MCP server the shell translates to */
  readonly server: McpServer
  readonly host?: string
  /** 0 (default) picks a free port; pass a fixed one to pin it */
  readonly port?: number
}

interface ToolCall {
  readonly ok: boolean
  readonly text: string
}

/** call one board tool and get its JSON text payload */
const call = async (client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolCall> => {
  try {
    const result = await client.callTool({ name, arguments: args })
    const first = Array.isArray(result.content) ? result.content[0] : undefined
    const text = first !== undefined && first.type === "text" ? first.text : JSON.stringify(result)
    return { ok: true, text }
  } catch (error) {
    return { ok: false, text: JSON.stringify({ ok: false, detail: error instanceof Error ? error.message : String(error) }) }
  }
}

/** parse a tool response's JSON text; never leaks parse/SDK noise to the caller */
const parseToolText = (call: ToolCall): { ok: boolean; detail?: string } | Record<string, unknown> => {
  if (!call.ok) return { ok: false, detail: "tool call failed" }
  try { return JSON.parse(call.text) as Record<string, unknown> } catch { return { ok: false, detail: "coordinator unavailable (no model configured for the board)" } }
}

const readBody = async (request: Request): Promise<Record<string, unknown>> => {
  const raw = await request.text()
  if (raw === "") return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { error: "invalid JSON body" }
  }
}

import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { applyClaudeIntegration, claudeStatus, probeClaudeGate, revertClaudeIntegration, type ClaudeCliPaths } from "./integration/claude.ts"
import { applyGlobalClaudeIntegration, globalClaudeStatus, revertGlobalClaudeIntegration } from "./integration/claude-global.ts"


const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8"
}
/** preloaded static bundle from ./public (built by `bun run build:web`) */
const staticFiles: Map<string, { type: string; body: Uint8Array }> = new Map()
{
  const dir = new URL("./public", import.meta.url).pathname
  const names = ["index.html", "style.css", "app.css", "app.js"]
  for (const name of names) {
    const file = dir + "/" + name
    if (existsSync(file)) {
      const ext = "." + name.split(".").pop()!
      staticFiles.set("/" + name, { type: MIME[ext] ?? "application/octet-stream", body: readFileSync(file) })
    }
  }
}


/** integration paths, resolved against this file (apps/board/src/hosts/web) */
const integrationContext = () => {
  const base = resolve(import.meta.dir, "..", "..", "..", "..", "..") // 5 ups -> repo root
  const paths: ClaudeCliPaths = {
    bunCli: process.env.BOARD_BUN ?? process.execPath,
    claudeCli: process.env.BOARD_CLAUDE_CLI ?? (process.env.HOME !== undefined ? resolve(process.env.HOME, ".local", "bin", "claude") : "/Users/user/.local/bin/claude"),
    mcpEntry: resolve(base, "apps", "board", "src", "hosts", "mcp", "main.ts"),
    preflightEntry: resolve(base, "apps", "board", "scripts", "board-preflight.ts"),
    dataFile: process.env.BOARD_DATA_FILE ?? resolve(base, ".board-data", "board.json")
  }
  const target = process.env.BOARD_INTEGRATION_DIR ?? base
  return { paths, target }
}
const homeDir = () => process.env.BOARD_HOME ?? (process.env.HOME ?? "/Users/user")
const claudeApi = async (action: string, scope: string, probe: boolean) => {
  const ctx = integrationContext()
  if (scope === "global") {
    const home = homeDir()
    switch (action) {
      case "apply": applyGlobalClaudeIntegration(home, ctx.paths); return { ok: true, scope, state: globalClaudeStatus(home, ctx.paths, true) }
      case "revert": return { ok: true, scope, state: revertGlobalClaudeIntegration(home, ctx.paths) }
      default: return { ok: true, scope, state: globalClaudeStatus(home, ctx.paths, probe) }
    }
  }
  switch (action) {
    case "apply": {
      const state = applyClaudeIntegration(ctx.target, ctx.paths)
      return { ok: true, scope, state: { ...state, connected: probeClaudeGate(ctx.paths) } }
    }
    case "revert":
      return { ok: true, scope, state: revertClaudeIntegration(ctx.target) }
    default:
      return { ok: true, scope, state: { ...claudeStatus(ctx.target, ctx.paths), connected: probe ? probeClaudeGate(ctx.paths) : undefined } }
  }
}


export interface BoardWebStarted {
  readonly url: string
  readonly stop: () => void
}

export const serveBoardWeb = async (options: BoardWebOptions): Promise<BoardWebStarted> => {
  const host = options.host ?? "127.0.0.1"
  const mcpServer = options.server
  const client = new Client({ name: "board-web-console", version: "0.1.0" })
  const pair = InMemoryTransport.createLinkedPair()
  await mcpServer.connect(pair[0])
  await client.connect(pair[1])

  const json = (payload: unknown) =>
    new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } })

  const server = Bun.serve({
    hostname: host,
    port: options.port ?? 0,
    async fetch(request) {
      const url = new URL(request.url)
      const path = url.pathname
      try {
        if (path === "/api/health") return json({ ok: true })

        if (path === "/api/state") return json(JSON.parse((await call(client, "board_state")).text))
        if (path === "/api/view") {
          const r = await call(client, "board_view", { view: url.searchParams.get("view") ?? undefined })
          return json(r.ok ? JSON.parse(r.text) : { error: r.text })
        }
        if (path === "/api/events") {
          const r = await call(client, "board_events", { ts: Number(url.searchParams.get("ts") ?? "0") || 0 })
          return json(r.ok ? JSON.parse(r.text) : { events: [] })
        }
        if (path === "/api/integration/claude") {
          const body = request.method === "POST" ? ((await readBody(request)) as Record<string, unknown>) : {}
          const action = String(body.action ?? (request.method === "POST" ? "status" : url.searchParams.get("probe") === "1" ? "check" : "status"))
          const scope = String(body.scope ?? url.searchParams.get("scope") ?? "repo")
          const probe = body.action !== undefined ? (body.action as string) === "check" || (body.action as string) === "apply" : url.searchParams.get("probe") === "1"
          return json(await claudeApi(action, scope, probe).catch((error) => ({ ok: false, detail: error instanceof Error ? error.message : String(error) })))
        }
        if (request.method === "POST") {
          const body = await readBody(request)
          if (body.error !== undefined) return json({ ok: false, detail: body.error })
          switch (path) {
            case "/api/item": {
              // board_* tools carry list fields as strings (JSON or comma list)
              const args: Record<string, unknown> = { ...body }
              for (const key of ["requires", "dependencies", "labels"] as const) {
                const v = args[key]
                if (Array.isArray(v)) args[key] = JSON.stringify(v)
              }
              const r = await call(client, "board_create_item", args)
              return json(r.ok ? JSON.parse(r.text) : { ok: false, detail: r.text })
            }
            case "/api/item/start": {
              const r = await call(client, "board_start", { itemId: String(body.itemId ?? ""), executorId: String(body.executorId ?? "console") })
              return json(r.ok ? JSON.parse(r.text) : { ok: false, detail: r.text })
            }
            case "/api/item/done": return json(JSON.parse((await call(client, "board_report_done", { itemId: String(body.itemId ?? ""), detail: body.detail })).text))
            case "/api/item/fail": return json(JSON.parse((await call(client, "board_report_failed", { itemId: String(body.itemId ?? ""), detail: body.detail })).text))
            case "/api/item/cancel": return json(JSON.parse((await call(client, "board_cancel", { itemId: String(body.itemId ?? "") })).text))
            case "/api/item/block": return json(JSON.parse((await call(client, "board_block", { itemId: String(body.itemId ?? ""), reason: String(body.reason ?? "blocked") })).text))
            case "/api/item/unblock": return json(JSON.parse((await call(client, "board_unblock", { itemId: String(body.itemId ?? "") })).text))
            case "/api/executor": {
              const r = await call(client, "board_register_executor", {
                executorId: String(body.executorId ?? ""), kind: String(body.kind ?? "external"),
                name: String(body.name ?? body.executorId ?? ""), capability: body.capability
              })
              return json(r.ok ? JSON.parse(r.text) : { ok: false, detail: r.text })
            }
            case "/api/resource": {
              const r = await call(client, "board_create_resource", {
                resourceId: String(body.resourceId ?? ""), kind: String(body.kind ?? "external"),
                name: String(body.name ?? ""), capacity: Number(body.capacity ?? 1), concurrency: String(body.concurrency ?? "exclusive")
              })
              return json(r.ok ? JSON.parse(r.text) : { ok: false, detail: r.text })
            }
            case "/api/coordinate": {
              // coordinator is only registered when a model is configured; a missing
              // tool surfaces as ok:true + plain-text content, so parse defensively
              const r = await call(client, "board_coordinate", { itemId: String(body.itemId ?? "") })
              const payload = parseToolText(r)
              if (payload.ok !== false && typeof payload === "object") return json(payload)
              return json({ ok: false, detail: "coordinator unavailable (no model configured for the board)" })
            }
          }
        }
        const asset = path === "/" ? staticFiles.get("/index.html") : staticFiles.get(path)
        if (asset !== undefined) return new Response(asset.body, { headers: { "content-type": asset.type } })
        return json({ ok: false, detail: "not found: " + path })
      } catch (error) {
        return json({ ok: false, detail: error instanceof Error ? error.message : String(error) })
      }
    }
  })

  const startedUrl = "http://" + host + ":" + server.port
  return {
    url: startedUrl,
    stop: () => {
      server.stop()
      void client.close().catch(() => undefined)
    }
  }
}
