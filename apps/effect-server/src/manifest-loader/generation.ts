/**
 * Where a reloaded app's code is materialized, and which generation of it serves.
 *
 * Bun caches a module by the path it resolved to, and a query string does not
 * change that for the modules *underneath*: `import(entry + "?v=1")` runs the
 * entry again, but every file that entry reaches by a relative path is still
 * found at the path it was cached under and is handed back unchanged. Stamping
 * the entry therefore reloads an app's `effect-app.ts` and none of the code the
 * app is actually made of. That was measured, not assumed — an edited view kept
 * serving its old text while the reload reported success.
 *
 * So a generation is a *path*, not a query. Reloading copies the app's own
 * directory to a fresh one and imports the entry from there, which makes every
 * module in the graph a module this process has never seen.
 *
 * Two properties the copy has to keep:
 *
 *   - **Layout.** A module resolving a resource against `import.meta.dir` still
 *     finds it, because the app's tree came along in the same shape.
 *   - **Sharing.** Bare specifiers still resolve to the one copy of each
 *     workspace package, so schemas and registries stay single instances rather
 *     than becoming one per generation. That is why generations live beside the
 *     apps and not in a temp directory: it keeps `node_modules` and the
 *     workspace above them reachable.
 *
 * Nothing in an app is loaded from its own `node_modules` — copying that would
 * be copying the workspace — so the copy skips it, and skips any earlier
 * generation sitting under the same root.
 */

import { cp, readdir, rm } from "node:fs/promises"
import { join, sep } from "node:path"

/** Where generations live: one level under an app root, where discovery does not look. */
export const RELOAD_DIR = ".effect-reload"

const serving = new Map<string, number>()
const issued = new Map<string, number>()

/** The generation an app is serving. 0 is the app's own directory, as boot loaded it. */
export const servingGeneration = (appId: string): number => serving.get(appId) ?? 0

/**
 * The next generation number for an app, never a number it has used before.
 *
 * Numbers are not reused after a failure, and that is not tidiness. A module
 * whose evaluation threw is as cached as one that succeeded: re-importing the
 * same path re-throws the same error for the life of the process, so overwriting
 * the directory would not clear it. A number that has failed is spent.
 */
export const nextNumber = (appId: string): number => {
  const number = (issued.get(appId) ?? 0) + 1
  issued.set(appId, number)
  return number
}

/**
 * Where a generation's code is. Generation 0 is the app's own directory, so
 * nothing is copied until something is actually reloaded.
 */
export const dirOf = (appRoot: string, appId: string, generation: number, ownDir: string): string =>
  generation === 0 ? ownDir : join(appRoot, RELOAD_DIR, appId, String(generation))

const skipped = (path: string): boolean => {
  const parts = path.split(sep)
  return parts.includes("node_modules") || parts.includes(RELOAD_DIR)
}

/**
 * Copy an app's tree to `to`. Always from the app's own directory: that is where
 * the edit was made, and copying a copy would fossilize the generation after.
 */
export const materialize = async (from: string, to: string): Promise<void> => {
  await rm(to, { recursive: true, force: true })
  await cp(from, to, { recursive: true, filter: (source) => !skipped(source) })
}

/**
 * Commit a generation: it serves now, and the one it displaced is the rollback
 * target. Every other copy — failed attempts included — is dropped, so an app
 * leaves at most two directories behind however many times it is reloaded.
 */
export const commit = async (appRoot: string, appId: string, generation: number): Promise<void> => {
  const displaced = servingGeneration(appId)
  serving.set(appId, generation)
  const parent = join(appRoot, RELOAD_DIR, appId)
  const keep = new Set([String(generation), String(displaced)])
  for (const entry of await readdir(parent).catch(() => [])) {
    if (!keep.has(entry)) await rm(join(parent, entry), { recursive: true, force: true })
  }
}

/** Remove every copy under a root: what a shutdown owes the working tree. */
export const sweep = async (appRoot: string): Promise<void> => {
  serving.clear()
  issued.clear()
  await rm(join(appRoot, RELOAD_DIR), { recursive: true, force: true })
}
