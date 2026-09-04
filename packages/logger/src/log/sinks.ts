/**
 * log/sinks.ts - the SWAPPABLE SINKS.
 *
 * Concept: console is just one sink - production hosts route the same
 * entries to JSON lines or any other sink without changing a call site.
 * Each sink owns its threshold; composite fans an entry out to several,
 * honoring every member's own level (never taking the process down).
 */
import { appendFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"
import type { LogLevel, LogSink } from "./core.ts"

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

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
        // logging must never take the process down - fall back to stderr once
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
