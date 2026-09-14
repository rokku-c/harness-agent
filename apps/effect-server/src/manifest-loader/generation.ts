import { cp, readdir, rm } from "node:fs/promises"
import { join, sep } from "node:path"

export const RELOAD_DIR = ".effect-reload"

const serving = new Map<string, number>()
const issued = new Map<string, number>()

export const servingGeneration = (appId: string): number => serving.get(appId) ?? 0

export const nextNumber = (appId: string): number => {
  const number = (issued.get(appId) ?? 0) + 1
  issued.set(appId, number)
  return number
}

export const dirOf = (appRoot: string, appId: string, generation: number, ownDir: string): string =>
  generation === 0 ? ownDir : join(appRoot, RELOAD_DIR, appId, String(generation))

const skipped = (path: string): boolean => {
  const parts = path.split(sep)
  return parts.includes("node_modules") || parts.includes(RELOAD_DIR)
}

export const materialize = async (from: string, to: string): Promise<void> => {
  await rm(to, { recursive: true, force: true })
  await cp(from, to, { recursive: true, filter: (source) => !skipped(source) })
}

export const commit = async (appRoot: string, appId: string, generation: number): Promise<void> => {
  const displaced = servingGeneration(appId)
  serving.set(appId, generation)
  const parent = join(appRoot, RELOAD_DIR, appId)
  const keep = new Set([String(generation), String(displaced)])
  for (const entry of await readdir(parent).catch(() => [])) {
    if (!keep.has(entry)) await rm(join(parent, entry), { recursive: true, force: true })
  }
}

export const sweep = async (appRoot: string): Promise<void> => {
  serving.clear()
  issued.clear()
  await rm(join(appRoot, RELOAD_DIR), { recursive: true, force: true })
}
