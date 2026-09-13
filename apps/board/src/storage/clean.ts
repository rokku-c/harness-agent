/**
 * Moving an incompatible store aside.
 *
 * A clean is a rename, never a delete: those bytes are the operator's, and what
 * the product needs is "start from a store I understand", not "destroy what I
 * cannot read". The stamp says when it happened, so the operator can find the
 * file, read it, and decide what it was worth. SQLite's `-wal` and `-shm`
 * siblings travel with it — leaving them behind would let the next open recover
 * pages of the old store into the new one.
 */
import { existsSync, renameSync } from "node:fs"

/** Colons and dots are not worth arguing about in a filename. */
const stamp = (): string => new Date().toISOString().replace(/[:.]/g, "-")

export const clearStore = (file: string): string => {
  const moved = `${file}.incompatible-${stamp()}`
  renameSync(file, moved)
  for (const suffix of ["-wal", "-shm"]) {
    if (existsSync(file + suffix)) renameSync(file + suffix, moved + suffix)
  }
  return moved
}
