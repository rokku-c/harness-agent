import type { WorkKind } from "../workspace.ts"

export const MAX_RECORD_TEXT = 50_000
export const overRecordLimit = (text: string): string | undefined =>
  text.length > MAX_RECORD_TEXT ? "record text exceeds " + MAX_RECORD_TEXT + " characters (got " + text.length + ")" : undefined

export type EntrySource = "agent" | "ui"

export interface Entry {
  readonly id: string
  readonly kind: WorkKind
  readonly text: string
  readonly ts: number
  readonly source: EntrySource
}
