import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeBoard } from "../src/board.ts"

/** A store from an older board: schema this build does not understand, data the operator wrote. */
const writeOldSnapshot = (dataFile: string): void => {
  const db = new Database(dataFile)
  db.run("CREATE TABLE board_state(key TEXT PRIMARY KEY, value TEXT)")
  db.run("INSERT INTO board_state VALUES('snapshot','keep-me')")
  db.close()
}

const kept = (dataFile: string): unknown => {
  const db = new Database(dataFile)
  try { return db.query("SELECT value FROM board_state").get() } finally { db.close() }
}

test("two instances read current SQLite task rows, not stale whole-board snapshots", () => {
  const dir = mkdtempSync(join(tmpdir(), "board-current-")), dataFile = join(dir, "board.sqlite")
  const first = makeBoard({ dataFile }), second = makeBoard({ dataFile })
  try {
    const a = first.create({ title: "a" }), b = second.create({ title: "b" })
    first.update(b.id, { state: "doing" })
    expect(second.list().map((t) => t.id)).toEqual([a.id, b.id])
    expect(second.get(b.id).state).toBe("doing")
    expect(second.events()).toHaveLength(3)
  } finally { first.close(); second.close() }
  const reopened = makeBoard({ dataFile })
  try { expect(reopened.list().map((t) => t.title)).toEqual(["a", "b"]) }
  finally { reopened.close(); rmSync(dir, { recursive: true, force: true }) }
})
test("an incompatible store is cleaned or refused, never migrated in place", () => {
  const dir = mkdtempSync(join(tmpdir(), "board-old-")), dataFile = join(dir, "board.sqlite")
  writeOldSnapshot(dataFile)
  try {
    const board = makeBoard({ dataFile })
    try {
      board.create({ title: "after the clean" })
      expect(board.list().map((t) => t.title)).toEqual(["after the clean"])
    } finally { board.close() }
    const moved = readdirSync(dir).filter((name) => name.startsWith("board.sqlite.incompatible-"))
    expect(moved).toHaveLength(1)
    // the bytes are the operator's: a clean moves the file, it never deletes it
    expect(kept(join(dir, moved[0] as string))).toEqual({ value: "keep-me" })

    writeOldSnapshot(dataFile)
    expect(() => makeBoard({ dataFile, incompatibleStore: "refuse" })).toThrow("Incompatible Board store")
    expect(kept(dataFile)).toEqual({ value: "keep-me" })
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
