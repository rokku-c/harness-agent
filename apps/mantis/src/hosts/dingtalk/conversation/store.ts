/**
 * conversation/store.ts - the ConversationStore.
 *
 * Concept: in-memory per-conversation logs + enabled-tool meta behind the
 * same SQLite durability seam.
 */
import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { Effect } from "effect"
import { eaUri } from "@effect-agent/core"
import type { Binding, Content } from "@effect-agent/core"
import type { Turn, ConversationStoreOptions } from "./contract.ts"
import { historyBinding as makeHistoryBinding, renderHistory } from "./binding.ts"

export class ConversationStore {
  readonly #log = new Map<string, Turn[]>()
  readonly #meta = new Map<string, string[]>()
  readonly #database: Database

  constructor(options: ConversationStoreOptions = {}) {
    const file = options.dir === undefined ? ":memory:" : join(options.dir, "conversations.sqlite")
    if (options.dir !== undefined) mkdirSync(options.dir, { recursive: true })
    this.#database = new Database(file, { create: true })
    this.#database.run("CREATE TABLE IF NOT EXISTS mantis_turns (id INTEGER PRIMARY KEY, conversation_id TEXT, role TEXT, text TEXT, ts INTEGER)")
    this.#database.run("CREATE TABLE IF NOT EXISTS mantis_meta (conversation_id TEXT PRIMARY KEY, names TEXT)")
    for (const row of this.#database.query("SELECT conversation_id, role, text, ts FROM mantis_turns ORDER BY id").all() as Array<{ conversation_id: string } & Turn>) {
      const turns = this.#log.get(row.conversation_id) ?? []
      turns.push({ role: row.role, text: row.text, ts: row.ts }); this.#log.set(row.conversation_id, turns)
    }
    for (const row of this.#database.query("SELECT conversation_id, names FROM mantis_meta").all() as Array<{ conversation_id: string; names: string }>)
      this.#meta.set(row.conversation_id, JSON.parse(row.names) as string[])
  }

  readonly conversationIds = (): ReadonlyArray<string> => [...this.#log.keys(), ...this.#meta.keys()].filter((id, i, all) => all.indexOf(id) === i)

  /** extended tools a conversation had enabled (persisted with the turns) */
  readonly enabled = (conversationId: string): ReadonlyArray<string> => [...(this.#meta.get(conversationId) ?? [])]

  /** persist one more enabled tool for a conversation (append-only with the turns) */
  readonly recordEnabled = (conversationId: string, name: string): void => {
    const current = this.#meta.get(conversationId) ?? []
    if (current.includes(name)) return
    const next = [...current, name]
    this.#meta.set(conversationId, next)
    this.#database.run("INSERT OR REPLACE INTO mantis_meta VALUES (?, ?)", [conversationId, JSON.stringify(next)])
  }

  readonly add = (conversationId: string, role: Turn["role"], text: string): void => {
    const turns = this.#log.get(conversationId) ?? []
    turns.push({ role, text, ts: Date.now() })
    this.#log.set(conversationId, turns)
    const turn = turns[turns.length - 1]!
    this.#database.run("INSERT INTO mantis_turns (conversation_id, role, text, ts) VALUES (?, ?, ?, ?)", [conversationId, turn.role, turn.text, turn.ts])
  }
  readonly history = (conversationId: string): ReadonlyArray<Turn> => [...(this.#log.get(conversationId) ?? [])]

  /** a read-only binding materialized into the session context each run */
  readonly historyBinding = (conversationId: string, maxTurns = 30): Binding<never, never, never> =>
    makeHistoryBinding(conversationId, () => renderHistory(this.history(conversationId), maxTurns))
}
