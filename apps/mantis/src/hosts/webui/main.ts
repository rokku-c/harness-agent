import { envVar } from "../../env.ts"
import { workspaceFile } from "../../paths.ts"
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

const memoryDir = undefined
const web = new WebConsole({
  bus,
  model: buildModelFromConfig(config.model),
  maxSteps: config.model.maxSteps,
  maxReflections: config.model.maxReflections,
  protectedTools: config.approvals.protectedTools,
  approveTimeoutMs: config.approvals.timeoutMs,
  workspaceFile: workspaceFile(),
  memoryDir,
  logger
})
const mcpServer = makeMantisMcp({ console: web })
const mcpClient = new Client({ name: "mantis-web-console", version: "0.1.0" })
const mcpPair = InMemoryTransport.createLinkedPair()
await mcpServer.connect(mcpPair[0])
await mcpClient.connect(mcpPair[1])

const { url } = serveConsole({
  client: mcpClient,
  host: envVar("WEB_HOST") ?? "127.0.0.1",
  port: Number(envVar("WEB_PORT") ?? 3737)
})
logger.info("mantis web console live on " + url, {
  workspaceFile: workspaceFile(),
  memoryDir,
  protectedTools: config.approvals.protectedTools.join(",") || "none"
})
