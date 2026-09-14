import { rm } from "node:fs/promises"
import { join } from "node:path"

export interface BundleGeneration {
  readonly generation: number
  readonly dir: string
}

export interface GenerationDirs {
  next(appId: string): BundleGeneration
  boot(appId: string): BundleGeneration
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
