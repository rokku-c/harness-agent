/**
 * tools/store.ts - NotesStore: the SHARED WORKSPACE.
 *
 * Concept: every declared resource kind lives in one SQLite workspace with search.
 * errors (limit exceeded) throw; ops convert them to explicit failures.
 */
import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { MAX_RECORD_TEXT, overRecordLimit, type Entry, type EntrySource } from "./contract.ts"

export interface NotesStoreOptions {
  /** SQLite database; :memory: keeps tests isolated. */
  readonly file?: string
}

export class NotesStore {
  readonly #entries: Entry[] = []
  private seq = 0
  readonly #database: Database

  constructor(options: NotesStoreOptions = {}) {
    const file = options.file ?? ":memory:"
    if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true })
    this.#database = new Database(file, { create: true })
    this.#database.run("CREATE TABLE IF NOT EXISTS mantis_notes (id TEXT PRIMARY KEY, kind TEXT NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL, source TEXT NOT NULL)")
    this.#entries.push(...this.#database.query("SELECT id, kind, text, ts, source FROM mantis_notes ORDER BY CAST(SUBSTR(id, 2) AS INTEGER)").all() as Entry[])
    this.seq = Math.max(0, ...this.#entries.map((entry) => Number(entry.id.slice(1))))
  }
  readonly add = (kind: Entry["kind"], text: string, source: EntrySource = "agent"): Entry => {
    const over = overRecordLimit(text)
    if (over !== undefined) throw new Error(over)
    const entry: Entry = { id: "e" + ++this.seq, kind, text, ts: Date.now(), source }
    this.#entries.push(entry)
    this.#database.run("INSERT INTO mantis_notes VALUES (?, ?, ?, ?, ?)", [entry.id, entry.kind, entry.text, entry.ts, entry.source])
    return entry
  }
  /** replace one record's text (provenance source unchanged; a new ts is stamped) */
  readonly update = (id: string, text: string): Entry | undefined => {
    const over = overRecordLimit(text)
    if (over !== undefined) throw new Error(over)
    const index = this.#entries.findIndex((e) => e.id === id)
    if (index === -1) return undefined
    const updated: Entry = { ...this.#entries[index]!, text, ts: Date.now() }
    this.#entries[index] = updated
    this.#database.run("UPDATE mantis_notes SET text = ?, ts = ? WHERE id = ?", [text, updated.ts, id])
    return updated
  }

  /** delete one record by id (removed from search/all; durable via an op line) */
  readonly remove = (id: string): boolean => {
    const index = this.#entries.findIndex((e) => e.id === id)
    if (index === -1) return false
    this.#entries.splice(index, 1)
    this.#database.run("DELETE FROM mantis_notes WHERE id = ?", [id])
    return true
  }

  readonly search = (query: string, kind?: Entry["kind"], source?: EntrySource): ReadonlyArray<Entry> =>
    this.#entries.filter(
      (entry) =>
        (kind === undefined || entry.kind === kind) &&
        (source === undefined || entry.source === source) &&
        (query === "" || entry.text.includes(query))
    )
  readonly all = (): ReadonlyArray<Entry> => [...this.#entries]
}
