import type { Database } from "bun:sqlite"
import { parse } from "../tasks/schema.ts"
import { documentSchema, type Document } from "./schema.ts"

export const makeDocStore = (db: Database) => ({
  list: (): Document[] => db.query<{ data: string }, []>("SELECT data FROM documents ORDER BY rowid").all()
    .map((row) => parse(documentSchema, JSON.parse(row.data))),
  get: (docId: string): Document | undefined => {
    const row = db.query<{ data: string }, [string]>("SELECT data FROM documents WHERE id=?").get(docId)
    return row === undefined || row === null ? undefined : parse(documentSchema, JSON.parse(row.data))
  },
  put: (doc: Document) => db.run("INSERT INTO documents(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    [doc.docId, JSON.stringify(doc)]),
  delete: (docId: string) => db.run("DELETE FROM documents WHERE id=?", [docId]),
})
export type DocStore = ReturnType<typeof makeDocStore>
