import { appendFile, mkdir, readFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { JsonPatch, Spec } from "@json-render/core"
import { makeSpecStreamAdapter, type SpecStreamAdapter } from "./spec-stream.ts"
import { decodeSpecRecord, recoveryOf, type SpecJournalRecord, type SpecRecovery } from "./spec-session.ts"

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
  let pending: Promise<void> = Promise.resolve()
  const records = async () => {
    try { return (await readFile(file, "utf8")).split("\n").map(decodeSpecRecord).filter((r): r is SpecJournalRecord => r !== undefined) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error }
  }
  const write = async (record: SpecJournalRecord) => {
    pending = pending.then(async () => { await mkdir(dirname(file), { recursive: true }); await appendFile(file, JSON.stringify(record) + "\n") })
    await pending
  }
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
