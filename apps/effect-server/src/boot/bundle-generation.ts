/**
 * Where a bundle's generations live, and which number may be handed out next.
 *
 * The bundle half of `manifest-loader/generation.ts`, and it keeps that file's
 * central rule for that file's reason: a generation is a *directory*, because
 * re-importing a path is a cache lookup; and a number is spent once used, never
 * handed out again, because a module whose evaluation threw is as cached as one
 * that succeeded — rebuilding into a failed attempt's directory would re-import
 * the cached failure.
 */

import { rm } from "node:fs/promises"
import { join } from "node:path"

/** One generation of one bundle: the directory it was built in, and its number. */
export interface BundleGeneration {
  readonly generation: number
  readonly dir: string
}

export interface GenerationDirs {
  /** A number this app has never used, as its next generation's directory. */
  next(appId: string): BundleGeneration
  /** Start an app's numbering over: boot's generation is 0. */
  boot(appId: string): BundleGeneration
  /** Remove a generation's directory. Safe on one that was never written. */
  discard(generation: BundleGeneration): Promise<void>
}

export const makeGenerationDirs = (root: string): GenerationDirs => {
  const issued = new Map<string, number>()
  const at = (appId: string, generation: number): BundleGeneration =>
    ({ generation, dir: join(root, `${appId}-g${generation}`) })
  return {
    next: (appId) => {
      const number = (issued.get(appId) ?? 0) + 1
      issued.set(appId, number)
      return at(appId, number)
    },
    boot: (appId) => { issued.set(appId, 0); return at(appId, 0) },
    discard: ({ dir }) => rm(dir, { recursive: true, force: true }),
  }
}
