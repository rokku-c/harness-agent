export type LogLevel = "debug" | "info" | "warn" | "error"

export const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export interface LogEntry {
  readonly ts: string
  readonly level: LogLevel
  readonly scope: string
  readonly message: string
  readonly meta?: unknown
}

export interface LogSink {
  readonly write: (entry: LogEntry) => void
  readonly level?: LogLevel
}

export interface Logger {
  readonly debug: (message: string, meta?: unknown) => void
  readonly info: (message: string, meta?: unknown) => void
  readonly warn: (message: string, meta?: unknown) => void
  readonly error: (message: string, meta?: unknown) => void
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
