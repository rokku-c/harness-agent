/**
 * Logger package: level filtering, scoping, composition and file persistence.
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  compositeSink, consoleSink, jsonFileSink, makeLogger, noopLogger,
  type LogEntry, type LogSink
} from "../src/log.ts"

const captureSink = (): LogSink & { entries: LogEntry[] } => {
  const entries: LogEntry[] = []
  return { level: "debug", entries, write: (entry) => entries.push(entry) }
}

describe("logger", () => {
  test("levels filter below the sink threshold; meta is attached", () => {
    const sink = captureSink()
    const logger = makeLogger(sink, "svc")
    logger.debug("d1")
    logger.info("i1", { n: 1 })
    logger.warn("w1")
    const quiet = makeLogger(captureSink(), "")
    quiet.debug("hidden")
    expect(sink.entries.map((e) => e.level + ":" + e.message)).toEqual(["debug:d1", "info:i1", "warn:w1"])
    expect(sink.entries[1]!.meta).toEqual({ n: 1 })
  })

  test("a warn-level sink drops debug and info", () => {
    const entries: LogEntry[] = []
    const logger = makeLogger({ level: "warn", write: (e) => entries.push(e) }, "x")
    logger.info("no")
    logger.error("yes")
    expect(entries.map((e) => e.level)).toEqual(["error"])
  })

  test("child scopes join the parent scope", () => {
    const sink = captureSink()
    makeLogger(sink, "host").child("session.abc-1").info("turn")
    expect(sink.entries[0]!.scope).toBe("host.session.abc-1")
  })

  test("composite fans out to every sink, respecting each threshold", () => {
    const a = captureSink()
    const b: LogSink = { level: "error", write: () => {} }
    const writes: string[] = []
    const bSpy = { level: "error" as const, write: (e: LogEntry) => writes.push(e.level) }
    const logger = makeLogger(compositeSink(a, bSpy), "")
    logger.info("to-a-only")
    logger.error("to-both")
    expect(a.entries.map((e) => e.message)).toEqual(["to-a-only", "to-both"])
    expect(writes).toEqual(["error"])
  })

  test("jsonFileSink persists structured JSON lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "mantis-log-"))
    const file = join(dir, "events.jsonl")
    const logger = makeLogger(jsonFileSink(file), "mantis")
    logger.info("started", { channel: "robot" })
    logger.error("boom", { callId: "c1" })
    const lines = readFileSync(file, "utf-8").trim().split("\n").map((l) => JSON.parse(l) as LogEntry)
    expect(lines).toHaveLength(2)
    expect(lines[0]!.message).toBe("started")
    expect(lines[0]!.meta).toEqual({ channel: "robot" })
    expect(lines[1]!.level).toBe("error")
    expect(lines[1]!.scope).toBe("mantis")
  })

  test("noopLogger writes nothing", () => {
    const logger = noopLogger()
    expect(() => logger.error("hidden")).not.toThrow()
  })

  test("consoleSink renders levels", () => {
    const logs: string[] = []
    const original = console.log
    console.log = (line: unknown) => logs.push(String(line))
    try {
      makeLogger(consoleSink(), "svc").info("hello", { a: 1 })
    } finally {
      console.log = original
    }
    expect(logs.some((l) => l.includes("INFO") && l.includes("hello") && l.includes("svc"))).toBe(true)
  })
})
