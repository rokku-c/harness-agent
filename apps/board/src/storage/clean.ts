import { existsSync, renameSync } from "node:fs"

const stamp = (): string => new Date().toISOString().replace(/[:.]/g, "-")

export const clearStore = (file: string): string => {
  const moved = `${file}.incompatible-${stamp()}`
  renameSync(file, moved)
  for (const suffix of ["-wal", "-shm"]) {
    if (existsSync(file + suffix)) renameSync(file + suffix, moved + suffix)
  }
  return moved
}
