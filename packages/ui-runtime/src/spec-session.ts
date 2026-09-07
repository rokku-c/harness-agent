import type { JsonPatch } from "@json-render/core"

export type SpecJournalRecord =
  | { readonly kind: "start"; readonly streamId: string }
  | { readonly kind: "patch"; readonly streamId?: string; readonly patch: JsonPatch }
  | { readonly kind: "done"; readonly streamId: string }

export interface SpecRecovery {
  readonly applied: number
  readonly status: "idle" | "completed" | "interrupted"
  readonly streamId?: string
  readonly retryable: boolean
}

const isPatch = (value: unknown): value is JsonPatch => {
  if (typeof value !== "object" || value === null) return false
  const patch = value as Partial<JsonPatch>
  return typeof patch.op === "string" && typeof patch.path === "string"
}

export const decodeSpecRecord = (line: string): SpecJournalRecord | undefined => {
  try {
    const value = JSON.parse(line) as Record<string, unknown>
    if (isPatch(value)) return { kind: "patch", patch: value }
    if (value.kind === "patch" && isPatch(value.patch)) {
      return { kind: "patch", streamId: typeof value.streamId === "string" ? value.streamId : undefined, patch: value.patch }
    }
    if ((value.kind === "start" || value.kind === "done") && typeof value.streamId === "string") {
      return { kind: value.kind, streamId: value.streamId }
    }
  } catch { return undefined }
}

export const recoveryOf = (records: ReadonlyArray<SpecJournalRecord>, applied: number): SpecRecovery => {
  let active: string | undefined
  let completed: string | undefined
  for (const record of records) {
    if (record.kind === "start") active = record.streamId
    if (record.kind === "done" && record.streamId === active) { completed = active; active = undefined }
  }
  if (active !== undefined) return { applied, status: "interrupted", streamId: active, retryable: true }
  if (completed !== undefined) return { applied, status: "completed", streamId: completed, retryable: false }
  return { applied, status: "idle", retryable: false }
}
