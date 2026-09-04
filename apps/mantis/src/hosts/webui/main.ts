/**
 * mantis web console live entry: observability + access over HTTP/SSE.
 *
 * The console reuses the exact live config (config.toml + env) of the other
 * hosts: same [agent] model, same MANTIS_PROTECTED approval policy - except
 * that here the operator IS the web page: pending approvals render as cards
 * and are resolved with a click, and every mantis session event streams to
 * the page.
 *
 * Agent UI: sessions can call the extended ui_render tool to push A2UI-style
 * surfaces; every accepted surface is a versioned git-tracked file under
 * MANTIS_UI_DIR (default apps/mantis/.ui) - roll back from the page.
 *
 * The browser cannot speak MCP stdio, so this process maps every /api call
 * onto the in-process mantis MCP server (InMemoryTransport) - the web panel
 * IS an MCP client, like Claude Code; there is no other path into the host.
 *
 * Env: MANTIS_WEB_HOST (default 127.0.0.1), MANTIS_WEB_PORT (default 3737),
 * MANTIS_UI_DIR, plus the standard MANTIS_* env (config/model/protected).
 *
 * Run: bun apps/mantis/src/hosts/webui/main.ts
 */
import { join } from "node:path"
import { envVar } from "../../env.ts"
import { loadConfig } from "../../config.ts"
import { buildModelFromConfig } from "../../model.ts"
import { compositeSink, consoleSink, jsonFileSink, makeLogger, type LogLevel, type LogEntry } from "@effect-agent/logger"
import { WebConsole } from "./console.ts"
import { serveConsole } from "./server.ts"
import { Bus } from "./bus.ts"
import type { LogSink } from "@effect-agent/logger"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { makeMantisMcp } from "../mcp/mcp.ts"

const config = loadConfig()
const logLevel = (envVar("LOG_LEVEL") ?? "info") as LogLevel
const logFile = envVar("LOG_FILE")

// one bus shared by the console and the logger: every entry (debug level
// included - tool calls) streams to open pages and is queryable by state
const bus = new Bus()
const sinks: LogSink[] = [{
  level: "debug",
  write: (entry: LogEntry) => {
    bus.push({ type: "log", level: entry.level, scope: entry.scope, message: entry.message })
  }
}]
sinks.push(consoleSink({ level: logLevel }))
if (logFile !== undefined) sinks.push(jsonFileSink(logFile, { level: logLevel }))
const logger = makeLogger(compositeSink(...sinks), "mantis")
for (const warning of config.warnings) logger.warn(warning)

const uiDir = envVar("UI_DIR") ?? join(import.meta.dir, "../../../.ui")
// durable shared workspace: one append-only JSONL next to the agent UI files
// (override the location with MANTIS_WORKSPACE_FILE; empty string disables)
const workspaceFile = envVar("WORKSPACE_FILE") === "" ? undefined : envVar("WORKSPACE_FILE") ?? join(uiDir, "workspace.jsonl")
// durable conversation memory: turns survive restarts (same data root)
const memoryDir = envVar("MEMORY_DIR") === "" ? undefined : envVar("MEMORY_DIR") ?? join(uiDir, "memory")
const web = new WebConsole({
  bus,
  model: buildModelFromConfig(config.model),
  maxSteps: config.model.maxSteps,
  maxReflections: config.model.maxReflections,
  protectedTools: config.approvals.protectedTools,
  approveTimeoutMs: config.approvals.timeoutMs,
  uiDir,
  workspaceFile,
  memoryDir,
  logger
})
// the backend of the web console IS the mantis MCP server; the HTTP shell
// is only a browser <-> MCP protocol translator (in-process transport)
const mcpServer = makeMantisMcp({ console: web })
const mcpClient = new Client({ name: "mantis-web-console", version: "0.1.0" })
const mcpPair = InMemoryTransport.createLinkedPair()
await mcpServer.connect(mcpPair[0])
await mcpClient.connect(mcpPair[1])

const { url } = serveConsole({
  client: mcpClient,
  publicDir: join(import.meta.dir, "public"),
  host: envVar("WEB_HOST") ?? "127.0.0.1",
  port: Number(envVar("WEB_PORT") ?? 3737)
})
logger.info("mantis web console live on " + url, {
  uiDir,
  workspaceFile,
  memoryDir,
  protectedTools: config.approvals.protectedTools.join(",") || "none"
})