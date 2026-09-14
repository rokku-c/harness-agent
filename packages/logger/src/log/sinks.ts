import { appendFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { LEVEL_ORDER, type LogLevel, type LogSink } from "./core.ts"

export interface SinkOptions {
  readonly level?: LogLevel
}

export const consoleSink = (options: SinkOptions = {}): LogSink => ({
  level: options.level ?? "info",
  write: (entry) => {
    const head = "[" + entry.ts + "] " + entry.level.toUpperCase() + " " + entry.scope + " " + entry.message
    const line = entry.meta === undefined ? head : head + " " + JSON.stringify(entry.meta)
    if (entry.level === "error") console.error(line)
    else if (entry.level === "warn") console.warn(line)
    else console.log(line)
  }
})

export const jsonFileSink = (filePath: string, options: SinkOptions = {}): LogSink => {
  mkdirSync(dirname(filePath), { recursive: true })
  return {
    level: options.level ?? "info",
    write: (entry) => {
      try {
        appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8")
      } catch (error) {
        console.error("[logger] write failed for " + filePath + ":", error)
      }
    }
  }
}

export const compositeSink = (...sinks: LogSink[]): LogSink => {
  const level = sinks.reduce<LogLevel | undefined>(
    (lowest, sink) =>
      lowest === undefined || LEVEL_ORDER[sink.level ?? "info"] < LEVEL_ORDER[lowest] ? sink.level ?? "info" : lowest,
    undefined
  )
  return {
    level: level ?? "info",
    write: (entry) => {
      for (const sink of sinks) {
        if (LEVEL_ORDER[entry.level] >= LEVEL_ORDER[sink.level ?? "info"]) sink.write(entry)
      }
    }
  }
}

export const noopSink = (): LogSink => ({ level: "error", write: () => {} })
