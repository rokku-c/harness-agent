/**
 * tools/contract.ts - the WORKSPACE ENTRY CONTRACT + write limits.
 *
 * Concept: every record in the shared workspace has one shape (id/kind/text/
 * ts/source); "source" records who wrote it (the session agent or the
 * operator UI) so recall can filter provenance. Record length is bounded by
 * one authority and enforced before any write - no silent truncation.
 */
import type { WorkKind } from "../workspace.ts"

/** maximum record length for workspace writes (the store throws, ops fail) */
export const MAX_RECORD_TEXT = 50_000
export const overRecordLimit = (text: string): string | undefined =>
  text.length > MAX_RECORD_TEXT ? "record text exceeds " + MAX_RECORD_TEXT + " characters (got " + text.length + ")" : undefined

/** who recorded an entry: the session agent or the operator (workspace UI) */
export type EntrySource = "agent" | "ui"

export interface Entry {
  readonly id: string
  readonly kind: WorkKind
  readonly text: string
  readonly ts: number
  readonly source: EntrySource
}
