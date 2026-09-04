/**
 * mantis MCP server (stdio) - other agents drive mantis as tools.
 *
 * The server is a third host of the same mantis wiring (config.toml +
 * MANTIS_* env): same model, same protected tools, same approval semantics.
 *
 * Claude Code config (~/.claude.json "mcpServers"):
 *   "mantis": { "command": "bun", "args": ["run", "apps/mantis/src/hosts/mcp/main.ts"], "cwd": "<repo root>" }
 *
 * Run: bun apps/mantis/src/hosts/mcp/main.ts   (stdio transport)
 */
import { join } from "node:path"
import { envVar } from "../../env.ts"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { loadConfig } from "../../config.ts"
import { buildModelFromConfig } from "../../model.ts"
import { compositeSink, jsonFileSink, makeLogger, type LogLevel, type LogSink, type LogEntry } from "@effect-agent/logger"
import { WebConsole } from "../webui/console.ts"
import { makeMantisMcp } from "./mcp.ts"

const config = loadConfig()
const logLevel = (envVar("LOG_LEVEL") ?? "info") as LogLevel
const logFile = envVar("LOG_FILE")
/** stdio transport owns stdout for JSON-RPC frames: diagnostics go to
 *  stderr (or a file). consoleSink would corrupt the protocol. */
const stderrSink: LogSink = {
  level: logLevel,
  write: (entry: LogEntry) => {
    process.stderr.write("[" + entry.level + "] " + (entry.scope ? entry.scope + ": " : "") + entry.message + "\n")
  }
}
const sinks = logFile === undefined
  ? [stderrSink]
  : [stderrSink, jsonFileSink(logFile, { level: logLevel })]
const logger = makeLogger(compositeSink(...sinks), "mantis")
for (const warning of config.warnings) logger.warn(warning)

const web = new WebConsole({
  model: buildModelFromConfig(config.model),
  maxSteps: config.model.maxSteps,
  maxReflections: config.model.maxReflections,
  protectedTools: config.approvals.protectedTools,
  approveTimeoutMs: config.approvals.timeoutMs,
  uiDir: envVar("UI_DIR") ?? join(import.meta.dir, "../../../.ui"),
  workspaceFile: envVar("WORKSPACE_FILE") ?? join(envVar("UI_DIR") ?? join(import.meta.dir, "../../../.ui"), "workspace.jsonl"),
  memoryDir: envVar("MEMORY_DIR") ?? join(envVar("UI_DIR") ?? join(import.meta.dir, "../../../.ui"), "memory"),
  logger
})
const server = makeMantisMcp({ console: web })
logger.info("mantis mcp server ready", {
  protectedTools: config.approvals.protectedTools.join(",") || "none"
})

const transport = new StdioServerTransport()
await server.connect(transport)
