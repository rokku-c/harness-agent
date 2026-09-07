import type { JsonPatch, Spec } from "@json-render/core"
import { makeSpecStreamAdapter, type SpecStreamAdapter } from "./spec-stream.ts"
import { recoveryOf, type SpecJournalRecord, type SpecRecovery } from "./spec-session.ts"
import { makeSQLiteLog } from "./sqlite-log.ts"

export interface SpecJournal {
  start(streamId: string): Promise<void>
  append(patch: JsonPatch, streamId?: string): Promise<void>
  done(streamId: string): Promise<void>
  read(): Promise<ReadonlyArray<JsonPatch>>
  records(): Promise<ReadonlyArray<SpecJournalRecord>>
  replay(adapter: SpecStreamAdapter): Promise<number>
  recover(adapter: SpecStreamAdapter): Promise<SpecRecovery>
}

export const makeSpecJournal = (file: string): SpecJournal => {
  const log = makeSQLiteLog<SpecJournalRecord>(file, "ui.spec-record")
  const records = log.read
  const write = log.append
  const read = async () => (await records()).filter((r) => r.kind === "patch").map((r) => r.patch)
  const recover = async (adapter: SpecStreamAdapter) => {
    const rows = await records()
    const patches = rows.filter((r) => r.kind === "patch")
    patches.forEach((row) => adapter.apply(row.patch))
    return recoveryOf(rows, patches.length)
  }
  return {
    start: (streamId) => write({ kind: "start", streamId }),
    append: (patch, streamId) => write({ kind: "patch", streamId, patch }),
    done: (streamId) => write({ kind: "done", streamId }),
    read, records,
    replay: async (adapter) => (await recover(adapter)).applied,
    recover
  }
}

export const restoreSpec = async (file: string, initial: Spec): Promise<SpecStreamAdapter> => {
  const adapter = makeSpecStreamAdapter(initial)
  await makeSpecJournal(file).replay(adapter)
  return adapter
}
