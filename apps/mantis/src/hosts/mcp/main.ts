import { envVar } from "../../env.ts"
import { workspaceFile } from "../../paths.ts"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { loadConfig } from "../../config.ts"
import { buildModelFromConfig } from "../../model.ts"
import { compositeSink, jsonFileSink, makeLogger, type LogLevel, type LogSink, type LogEntry } from "@effect-agent/logger"
import { WebConsole } from "../webui/console.ts"
import { makeMantisMcp } from "./mcp.ts"

const config = loadConfig()
const logLevel = (envVar("LOG_LEVEL") ?? "info") as LogLevel
const logFile = envVar("LOG_FILE")
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
  workspaceFile: workspaceFile(),
  logger
})
const server = makeMantisMcp({ console: web })
logger.info("mantis mcp server ready", {
  protectedTools: config.approvals.protectedTools.join(",") || "none"
})

const transport = new StdioServerTransport()
await server.connect(transport)
