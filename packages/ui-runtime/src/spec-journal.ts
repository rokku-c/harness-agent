import { appendFile, mkdir, readFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { JsonPatch, Spec } from "@json-render/core"
import { makeSpecStreamAdapter, type SpecStreamAdapter } from "./spec-stream.ts"

export interface SpecJournal {
  append(patch: JsonPatch): Promise<void>
  read(): Promise<ReadonlyArray<JsonPatch>>
  replay(adapter: SpecStreamAdapter): Promise<number>
}

const decode = (line: string): JsonPatch | undefined => {
  try {
    const value = JSON.parse(line) as JsonPatch
    return typeof value?.op === "string" && typeof value?.path === "string" ? value : undefined
  } catch { return undefined }
}

export const makeSpecJournal = (file: string): SpecJournal => {
  let pending: Promise<void> = Promise.resolve()
  const read = async () => {
    try { return (await readFile(file, "utf8")).split("\n").map(decode).filter((p): p is JsonPatch => p !== undefined) }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error }
  }
  const append = async (patch: JsonPatch) => {
    pending = pending.then(async () => { await mkdir(dirname(file), { recursive: true }); await appendFile(file, JSON.stringify(patch) + "\n") })
    await pending
  }
  return { append, read, replay: async (adapter) => { const patches = await read(); patches.forEach(adapter.apply); return patches.length } }
}

export const restoreSpec = async (file: string, initial: Spec): Promise<SpecStreamAdapter> => {
  const adapter = makeSpecStreamAdapter(initial)
  await makeSpecJournal(file).replay(adapter)
  return adapter
}
