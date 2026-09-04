/**
 * Barrel: the logger split by CONCEPT (see ./log/).
 * core.ts = shapes + facade; sinks.ts = console/file/composite/noop sinks;
 * factories.ts = ready-made loggers over them.
 */
export type { LogLevel, LogEntry, LogSink, Logger } from "./log/core.ts"
export { makeLogger } from "./log/core.ts"
export type { SinkOptions } from "./log/sinks.ts"
export { consoleSink, jsonFileSink, compositeSink, noopSink } from "./log/sinks.ts"
export { consoleLogger, jsonFileLogger, compositeLogger, noopLogger } from "./log/factories.ts"
