import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Database } from "bun:sqlite"
import { makeWebHandler } from "../src/web.ts"

const json = async (response: Response) => (await response.json()) as any
const post = (body: unknown) => new Request("http://ui/api/command", { method: "POST", body: JSON.stringify(body) })

test("canvases reopen after restart from the same database file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "ui-host-")), databaseFile = join(dir, "ui.sqlite")
  try {
    const first = makeWebHandler({ databaseFile })
    try {
      expect(await json(await first.handle(post({ kind: "create-canvas", canvasId: "notes", title: "Notes" })))).toMatchObject({ ok: true })
      await first.handle(post({ kind: "insert-node", canvasId: "notes", node: { id: "hello", type: "Text", props: { value: "persisted" } } }))
    } finally { first.close() }
    const second = makeWebHandler({ databaseFile })
    try {
      const canvas = await json(await second.handle(new Request("http://ui/api/canvas?canvasId=notes")))
      expect(canvas.title).toBe("Notes")
      expect(canvas.children.map((node: { id: string }) => node.id)).toEqual(["hello"])
      expect(canvas.children[0].resolvedProps.value).toBe("persisted")
      const canvases = await json(await second.handle(new Request("http://ui/api/canvases")))
      expect(canvases.map((item: { canvasId: string }) => item.canvasId).sort()).toEqual(["notes", "root"])
    } finally { second.close() }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test("a corrupt stored canvas snapshot fails loudly instead of seeding silently", () => {
  const dir = mkdtempSync(join(tmpdir(), "ui-host-")), databaseFile = join(dir, "ui.sqlite")
  const db = new Database(databaseFile)
  db.run("CREATE TABLE ui_canvas (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
  db.run("INSERT INTO ui_canvas VALUES ('canvases', '{not json')")
  db.close()
  try {
    expect(() => makeWebHandler({ databaseFile })).toThrow("Invalid stored canvas snapshot")
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
