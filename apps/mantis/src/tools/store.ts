/**
 * tools/store.ts - NotesStore: the SHARED WORKSPACE.
 *
 * Concept: every declared resource kind lives in one append log with search
 * (a single durable store shared by humans and agents). With an optional
 * JSONL file, each add/update/delete appends one op line and prior lines
 * reload on construction - id sequence continues across restarts. Store
 * errors (limit exceeded) throw; ops convert them to explicit failures.
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs"
import { dirname } from "node:path"
import { MAX_RECORD_TEXT, overRecordLimit, type Entry, type EntrySource } from "./contract.ts"

export interface NotesStoreOptions {
  /** append-only JSONL file: records persist and reload on construction */
  readonly file?: string
}

export class NotesStore {
  readonly #entries: Entry[] = []
  private seq = 0
  readonly #file?: string

  constructor(options: NotesStoreOptions = {}) {
    this.#file = options.file
    if (options.file === undefined) return
    try {
      mkdirSync(dirname(options.file), { recursive: true })
    } catch {
      // workspace degrades to in-memory when the directory is unusable
    }
    let text: string
    try {
      text = readFileSync(options.file, "utf-8")
    } catch {
      return // first run: no file yet
    }
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue
      try {
        const raw = JSON.parse(line) as Partial<Entry> & { op?: string }
        if (raw.op === "update" && typeof raw.id === "string" && typeof raw.text === "string" && typeof raw.ts === "number") {
          const index = this.#entries.findIndex((e) => e.id === raw.id)
          if (index !== -1) this.#entries[index] = { ...this.#entries[index]!, text: raw.text, ts: raw.ts }
          continue
        }
        if (raw.op === "delete" && typeof raw.id === "string") {
          const index = this.#entries.findIndex((e) => e.id === raw.id)
          if (index !== -1) this.#entries.splice(index, 1)
          continue
        }
        if (typeof raw.id === "string" && typeof raw.text === "string" && typeof raw.ts === "number" && typeof raw.kind === "string") {
          this.#entries.push({ id: raw.id, kind: raw.kind as Entry["kind"], text: raw.text, ts: raw.ts, source: raw.source === "ui" ? "ui" : "agent" })
          const n = Number(raw.id.slice(1))
          if (Number.isFinite(n) && n > this.seq) this.seq = n
        }
      } catch {
        // skip corrupted line and keep the rest of the log
      }
    }
  }
  readonly add = (kind: Entry["kind"], text: string, source: EntrySource = "agent"): Entry => {
    const over = overRecordLimit(text)
    if (over !== undefined) throw new Error(over)
    const entry: Entry = { id: "e" + ++this.seq, kind, text, ts: Date.now(), source }
    this.#entries.push(entry)
    if (this.#file !== undefined) appendFileSync(this.#file, JSON.stringify(entry) + "\n")
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
    if (this.#file !== undefined) appendFileSync(this.#file, JSON.stringify({ op: "update", id, text, ts: updated.ts }) + "\n")
    return updated
  }

  /** delete one record by id (removed from search/all; durable via an op line) */
  readonly remove = (id: string): boolean => {
    const index = this.#entries.findIndex((e) => e.id === id)
    if (index === -1) return false
    this.#entries.splice(index, 1)
    if (this.#file !== undefined) appendFileSync(this.#file, JSON.stringify({ op: "delete", id }) + "\n")
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
