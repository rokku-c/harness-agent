import { envVar } from "../../../env.ts"
import { loadConfig } from "../../../config.ts"
import { buildModelFromConfig } from "../../../model.ts"
import { compositeSink, consoleSink, jsonFileSink, makeLogger, type LogLevel } from "@effect-agent/logger"

export interface Runtime {
  readonly config: ReturnType<typeof loadConfig>
  readonly logger: ReturnType<typeof makeLogger>
  readonly model: ReturnType<typeof buildModelFromConfig>
  readonly logFile: string | undefined
}

export const setupRuntime = (): Runtime => {
  const config = loadConfig()
  const logLevel = (envVar("LOG_LEVEL") ?? "info") as LogLevel
  const logFile = envVar("LOG_FILE")
  const sinks = logFile === undefined
    ? [consoleSink({ level: logLevel })]
    : [consoleSink({ level: logLevel }), jsonFileSink(logFile, { level: logLevel })]
  const logger = makeLogger(compositeSink(...sinks), "mantis")
  for (const warning of config.warnings) logger.warn(warning)
  return { config, logger, model: buildModelFromConfig(config.model), logFile }
}
