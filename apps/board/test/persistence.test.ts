import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { makeBoard } from "../src/board.ts"

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
test("old snapshot schema is refused and left intact", () => {
  const dir = mkdtempSync(join(tmpdir(), "board-old-")), dataFile = join(dir, "board.sqlite")
  const old = new Database(dataFile)
  old.run("CREATE TABLE board_state(key TEXT PRIMARY KEY, value TEXT)")
  old.run("INSERT INTO board_state VALUES('snapshot','keep-me')")
  old.close()
  try {
    expect(() => makeBoard({ dataFile })).toThrow("no migration")
    const check = new Database(dataFile)
    expect(check.query("SELECT value FROM board_state").get()).toEqual({ value: "keep-me" })
    check.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
