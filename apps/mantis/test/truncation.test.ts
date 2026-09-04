/**
 * R23 hardening: no silent data loss.
 * 1) workspace writes have a hard length cap (store throws / ops fail
 *    explicitly - agent and operator REST paths get a readable error).
 * 2) observability trimming marks dropped length (+N chars) instead of a
 *    bare "…", so consumers can tell that truncation happened.
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NotesStore, MAX_RECORD_TEXT, overRecordLimit } from "../src/tools.ts"
import { short } from "../src/hosts/webui/console.ts"

describe("workspace record length cap", () => {
  test("exact MAX_RECORD_TEXT boundary is accepted", () => {
    const store = new NotesStore()
    const added = store.add("note", "x".repeat(MAX_RECORD_TEXT))
    expect(added.text.length).toBe(MAX_RECORD_TEXT)
    expect(store.all()).toHaveLength(1)
  })

  test("add over the cap throws a readable error and stores nothing", () => {
    const store = new NotesStore()
    const big = "y".repeat(MAX_RECORD_TEXT + 1)
    expect(() => store.add("task", big)).toThrow(/exceeds/)
    expect(overRecordLimit(big)).toContain(String(MAX_RECORD_TEXT))
    expect(store.all()).toHaveLength(0)
  })

  test("update over the cap throws and the original record is untouched", () => {
    const store = new NotesStore()
    const added = store.add("reminder", "keep this", "ui")
    const beforeTs = added.ts
    expect(() => store.update(added.id, "z".repeat(MAX_RECORD_TEXT + 5))).toThrow(/exceeds/)
    const after = store.all()[0]!
    expect(after.text).toBe("keep this")
    expect(after.ts).toBe(beforeTs)
    expect(after.source).toBe("ui")
  })

  test("over-limit add never pollutes the durable file (first run survives)", () => {
    const file = join(mkdtempSync(join(tmpdir(), "mantis-cap-")), "ws.jsonl")
    const store = new NotesStore({ file })
    store.add("note", "ok")
    expect(() => store.add("task", "q".repeat(MAX_RECORD_TEXT + 1))).toThrow()
    const reloaded = new NotesStore({ file })
    expect(reloaded.all().map((e) => e.text)).toEqual(["ok"])
  })
})

describe("observability truncation marker", () => {
  test("short values pass through untouched", () => {
    expect(short("hello", 10)).toBe("hello")
    expect(short({ a: 1 }, 50)).toBe('{"a":1}')
  })

  test("long strings are trimmed and the dropped count is explicit", () => {
    const text = "0123456789abcdef"
    const out = short(text, 10)
    expect(out.startsWith("0123456789")).toBe(true)
    expect(out).toContain("… (+truncated 6 chars)")
    expect(out.length).toBeGreaterThanOrEqual(10) // marker is explicit, not hidden
  })

  test("long serialized payloads also carry the marker", () => {
    const payload = { detail: "x".repeat(400) }
    const out = short(payload, 100)
    expect(out).toContain("… (+truncated ")
    expect(out.length).toBeLessThan(400)
  })
})
