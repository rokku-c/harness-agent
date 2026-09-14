import type { LogSink } from "./core.ts"
import { makeLogger } from "./core.ts"
import { compositeSink, consoleSink, jsonFileSink, noopSink, type SinkOptions } from "./sinks.ts"
import type { Logger } from "./core.ts"

export const consoleLogger = (options: SinkOptions = {}, scope = ""): Logger =>
  makeLogger(consoleSink(options), scope)
export const jsonFileLogger = (filePath: string, options: SinkOptions = {}, scope = ""): Logger =>
  makeLogger(jsonFileSink(filePath, options), scope)
export const compositeLogger = (scope = "", ...sinks: LogSink[]): Logger =>
  makeLogger(compositeSink(...sinks), scope)
export const noopLogger = (): Logger => makeLogger(noopSink())
