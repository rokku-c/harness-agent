/**
 * conversation/store.ts - the ConversationStore.
 *
 * Concept: in-memory per-conversation logs + enabled-tool meta behind the
 * same durability seam. Each conversation's turns are appended as JSONL ops
 * (turn / enabled) and reloaded into maps at construction; corrupted lines
 * are skipped so a bad write never destroys the rest of the memory log.
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { Effect } from "effect"
import { eaUri } from "@effect-agent/core"
import type { Binding, Content } from "@effect-agent/core"
import type { Turn, ConversationStoreOptions } from "./contract.ts"
import { historyBinding as makeHistoryBinding, renderHistory } from "./binding.ts"

export class ConversationStore {
  readonly #log = new Map<string, Turn[]>()
  readonly #meta = new Map<string, string[]>()
  readonly #dir?: string

  constructor(options: ConversationStoreOptions = {}) {
    this.#dir = options.dir
    if (options.dir === undefined) return
    try {
      mkdirSync(options.dir, { recursive: true })
    } catch {
      // memory degrades to in-memory when the directory is unusable
    }
    let text: string
    try {
      text = readFileSync(join(options.dir, "conversations.jsonl"), "utf-8")
    } catch {
      return // first run: no memory file yet
    }
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue
      try {
        const entry = JSON.parse(line) as Record<string, unknown>
        const conversationId = entry["conversationId"]
        if (entry["kind"] === "enabled" && Array.isArray(entry["names"]) && typeof conversationId === "string") {
          this.#meta.set(conversationId, (entry["names"] as unknown[]).filter((n) => typeof n === "string") as string[])
          continue
        }
        if (
          typeof conversationId === "string" &&
          (entry["role"] === "user" || entry["role"] === "assistant") &&
          typeof entry["text"] === "string" &&
          typeof entry["ts"] === "number"
        ) {
          const turns = this.#log.get(conversationId) ?? []
          turns.push({ role: entry["role"] as Turn["role"], text: entry["text"] as string, ts: entry["ts"] as number })
          this.#log.set(conversationId, turns)
        }
      } catch {
        // skip corrupted line and keep the rest of the memory log
      }
    }
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
    if (this.#dir !== undefined) {
      appendFileSync(join(this.#dir, "conversations.jsonl"), JSON.stringify({ conversationId, kind: "enabled", names: next, ts: Date.now() }) + "\n")
    }
  }

  readonly add = (conversationId: string, role: Turn["role"], text: string): void => {
    const turns = this.#log.get(conversationId) ?? []
    turns.push({ role, text, ts: Date.now() })
    this.#log.set(conversationId, turns)
    if (this.#dir !== undefined) {
      const turn = turns[turns.length - 1]!
      appendFileSync(join(this.#dir, "conversations.jsonl"), JSON.stringify({ conversationId, role: turn.role, text: turn.text, ts: turn.ts }) + "\n")
    }
  }
  readonly history = (conversationId: string): ReadonlyArray<Turn> => [...(this.#log.get(conversationId) ?? [])]

  /** a read-only binding materialized into the session context each run */
  readonly historyBinding = (conversationId: string, maxTurns = 30): Binding<never, never, never> =>
    makeHistoryBinding(conversationId, () => renderHistory(this.history(conversationId), maxTurns))
}

