import { resolve } from "node:path"
import { compileEffectBundle, loadEffectBundle, type EffectBundleApi } from "@effect-agent/effect-bundle"
import { makeGenerationDirs, type BundleGeneration } from "./bundle-generation.ts"
import type { ReloadOutcome } from "./reload-types.ts"

type Dispose = () => void | Promise<void>

export interface BundleApp {
  readonly appId: string
  readonly appDir: string
}

export interface BundleReloader {
  install(): Promise<readonly string[]>
  owns(appId: string): boolean
  reload(appId: string): Promise<ReloadOutcome>
  running(): readonly Dispose[]
}

interface Serving {
  readonly dispose: Dispose
  readonly at: BundleGeneration
}

export const makeBundleReloader = (options: {
  readonly apps: readonly BundleApp[]
  readonly root: string
  readonly api: EffectBundleApi
}): BundleReloader => {
  const dirs = makeGenerationDirs(options.root)
  const serving = new Map<string, Serving>()

  const connect = async (app: BundleApp, generation: BundleGeneration): Promise<Serving> => {
    const manifest = await compileEffectBundle({ appDir: app.appDir, outDir: generation.dir })
    const entry = resolve(generation.dir, manifest.bundleId + ".effect-bundle")
    return { dispose: await loadEffectBundle(entry, options.api), at: generation }
  }

  return {
    async install() {
      const failed: string[] = []
      for (const app of options.apps) {
        const generation = dirs.boot(app.appId)
        try { serving.set(app.appId, await connect(app, generation)) }
        catch (error) {
          failed.push(app.appId)
          await dirs.discard(generation)
          console.error(`[effect-server] bundle ${app.appId} did NOT load: `
            + (error instanceof Error ? error.message : String(error)))
        }
      }
      return failed
    },
    owns: (appId) => serving.has(appId),
    async reload(appId) {
      const current = serving.get(appId)
      const app = options.apps.find((candidate) => candidate.appId === appId)
      if (current === undefined || app === undefined) return { appId, ok: false, generation: 0, reason: "not-loaded" }
      const generation = dirs.next(appId)
      let next: Serving
      try { next = await connect(app, generation) } catch (error) {
        await dirs.discard(generation)
        return { appId, ok: false, generation: current.at.generation, reason: "failed", error }
      }
      serving.set(appId, next)
      await current.dispose()
      await dirs.discard(current.at)
      return { appId, ok: true, generation: generation.generation }
    },
    running: () => [...serving.values()].map((entry) => entry.dispose),
  }
}
