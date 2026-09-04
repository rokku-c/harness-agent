/**
 * log/core.ts - the LOGGER FACADE over one sink.
 *
 * Concept: a leveled logger is scope + thresholds applied to a sink. Sinks
 * are the swappable half (console/file/...); this file owns the shapes and
 * the emit rule: entries below the effective level are dropped before write.
 * Plain async TS on purpose - hosts (dingtalk channels, pm2 processes) are
 * not Effect fibers; this stays usable everywhere.
 */
export type LogLevel = "debug" | "info" | "warn" | "error"

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export interface LogEntry {
  readonly ts: string
  readonly level: LogLevel
  readonly scope: string
  readonly message: string
  readonly meta?: unknown
}

/** where entries go - a Logger is the leveled facade over one or more sinks */
export interface LogSink {
  readonly write: (entry: LogEntry) => void
  /** sink-level threshold; entries below it are dropped before write */
  readonly level?: LogLevel
}

export interface Logger {
  readonly debug: (message: string, meta?: unknown) => void
  readonly info: (message: string, meta?: unknown) => void
  readonly warn: (message: string, meta?: unknown) => void
  readonly error: (message: string, meta?: unknown) => void
  /** a logger scoped to a subsystem (e.g. "host.session.<conversationId>") */
  readonly child: (scope: string) => Logger
}

const log = (sink: LogSink, level: LogLevel, scope: string, message: string, meta?: unknown): void => {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[sink.level ?? "info"]) return
  sink.write({ ts: new Date().toISOString(), level, scope, message, meta })
}

const buildLogger = (sink: LogSink, scope: string): Logger => ({
  debug: (m, meta) => log(sink, "debug", scope, m, meta),
  info: (m, meta) => log(sink, "info", scope, m, meta),
  warn: (m, meta) => log(sink, "warn", scope, m, meta),
  error: (m, meta) => log(sink, "error", scope, m, meta),
  child: (sub) => buildLogger(sink, scope === "" ? sub : scope + "." + sub)
})

export const makeLogger = (sink: LogSink, scope = ""): Logger => buildLogger(sink, scope)
