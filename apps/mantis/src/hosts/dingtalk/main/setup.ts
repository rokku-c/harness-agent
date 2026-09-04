/**
 * main/setup.ts - RUNTIME BOOTSTRAP.
 *
 * Concept: config.toml (the ORIGINAL mantis config is read automatically -
 * see src/config.ts for what maps and what is deprecated) -> warnings ->
 * composite logger (console always; a JSON-lines file when MANTIS_LOG_FILE
 * is set) -> model. Every later assembly step consumes this one runtime.
 */
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
  // production logging: console always; a JSON-lines file when MANTIS_LOG_FILE is set
  const sinks = logFile === undefined
    ? [consoleSink({ level: logLevel })]
    : [consoleSink({ level: logLevel }), jsonFileSink(logFile, { level: logLevel })]
  const logger = makeLogger(compositeSink(...sinks), "mantis")
  for (const warning of config.warnings) logger.warn(warning)
  return { config, logger, model: buildModelFromConfig(config.model), logFile }
}
