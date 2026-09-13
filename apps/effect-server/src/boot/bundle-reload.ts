/**
 * Reloading a bundle-managed app — one this host compiles and connects back
 * rather than loading from `effect.yaml` (see `up.ts`).
 *
 * Such an app never enters the app layer, so `reload.ts` cannot see it. This is
 * the second load path's own reload, and it keeps that path's properties: the
 * compile is the same `compileEffectBundle`, and a generation is a directory
 * (see `bundle-generation.ts`), so a recompiled bundle is a module this process
 * has never read.
 *
 * A reload that fails leaves the serving generation alone: the new build goes to
 * its own directory, and the old one is removed only once the new one is live.
 */

import { resolve } from "node:path"
import { compileEffectBundle, loadEffectBundle, type EffectBundleApi } from "@effect-agent/effect-bundle"
import { makeGenerationDirs, type BundleGeneration } from "./bundle-generation.ts"
import type { ReloadOutcome } from "./reload-types.ts"

/** A bundle's unregister, which may be either shape. */
type Dispose = () => void | Promise<void>

/** One bundle this host owns: the app's name, and where its source is. */
export interface BundleApp {
  readonly appId: string
  readonly appDir: string
}

export interface BundleReloader {
  /** Compile and connect back every bundle as the generation boot loaded. Names that would not load. */
  install(): Promise<readonly string[]>
  /** Whether this app is one of ours — the question `reloadApp` asks before routing elsewhere. */
  owns(appId: string): boolean
  reload(appId: string): Promise<ReloadOutcome>
  /** The generations serving now, for teardown. */
  running(): readonly Dispose[]
}

interface Serving {
  readonly dispose: Dispose
  /** The generation this app is being served from. */
  readonly at: BundleGeneration
}

export const makeBundleReloader = (options: {
  readonly apps: readonly BundleApp[]
  /** Where generations are compiled: one directory each, under this root. */
  readonly root: string
  readonly api: EffectBundleApi
}): BundleReloader => {
  const dirs = makeGenerationDirs(options.root)
  const serving = new Map<string, Serving>()

  /** One generation: compiled into its own directory, then imported from there. */
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
        // Nothing to put back: the serving generation was never stopped, and the
        // directory it serves from was never written to.
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
