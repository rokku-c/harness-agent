/**
 * Reloading one app in place: a fresh generation, adjudicated, with the serving one
 * put back if the incoming one is worse. `generation.ts` is where the mechanism lives.
 */

import { dirname, join } from "node:path"
import { assessSurfaceChange, readAppSurface, registerEffectApp, type EffectAppDescriptor } from "@effect-agent/effect-apps"
import { defaultCompat, type CompatPolicy } from "@effect-agent/effect-compat"
import { discoverManifests, type Discovered } from "../yaml-manifest.ts"
import { commit, dirOf, materialize, nextNumber, servingGeneration } from "../manifest-loader/generation.ts"
import type { Disposer, LoadContext } from "../manifest-loader/types.ts"
import type { AppReloader, ReloadOutcome } from "./reload-types.ts"

export interface AppReloaderOptions {
  readonly roots: readonly string[]
  readonly context: LoadContext
  /** The apps this host runs: a reload is a *re*load, never a way to start one. */
  readonly loaded: () => readonly string[]
  /** Puts a reloaded app back in its place, returning the generation it displaced. */
  readonly swap: (appId: string, dispose: Disposer) => Disposer | undefined
  readonly policy?: CompatPolicy
}

/** What an app's module exports, when it exports the app we asked for. */
const descriptorAt = async (appId: string, path: string): Promise<EffectAppDescriptor | undefined> => {
  const mod = await import(path) as { effectApp?: EffectAppDescriptor }
  return mod.effectApp?.id === appId ? mod.effectApp : undefined
}

export const makeAppReloader = (options: AppReloaderOptions): AppReloader => {
  const policy = options.policy ?? defaultCompat
  const found = (appId: string): Discovered | undefined => discoverManifests(options.roots).find((d) => d.manifest.id === appId)

  return {
    async reload(appId) {
      const discovered = found(appId)
      const module = discovered?.manifest.module
      const outcome = (ok: boolean, rest: Omit<ReloadOutcome, "appId" | "ok" | "generation">): ReloadOutcome =>
        ({ appId, ok, generation: servingGeneration(appId), ...rest })
      if (!options.loaded().includes(appId)) return outcome(false, { reason: "not-loaded" })
      if (discovered === undefined || module === undefined) return outcome(false, { reason: "no-module" })

      const own = discovered.dir
      // Discovery builds `<root>/<id>`, so an app's parent is the root generations sit under.
      const root = dirname(own)
      const serving = servingGeneration(appId)
      const generation = nextNumber(appId)
      const moduleAt = (which: number): string => join(dirOf(root, appId, which, own), module)

      // What the incoming generation is judged against: the surface serving now.
      const surface = readAppSurface(options.context, appId)
      const previous = await descriptorAt(appId, moduleAt(serving))
      if (previous === undefined) return outcome(false, { reason: "no-module" })

      await materialize(own, dirOf(root, appId, generation, own))
      /**
       * Give up on this attempt. Its number is spent — re-importing it would re-throw
       * the cached error — so the copy is dead weight, and re-committing the
       * generation that is still serving retires it.
       */
      const failed = async (rest: Omit<ReloadOutcome, "appId" | "ok" | "generation">): Promise<ReloadOutcome> => {
        await commit(root, appId, serving)
        return outcome(false, rest)
      }
      let next: EffectAppDescriptor | undefined
      try { next = await descriptorAt(appId, moduleAt(generation)) } catch (error) { return failed({ reason: "failed", error }) }
      if (next === undefined) return failed({ reason: "failed", error: new Error(`${appId}: module exports no matching effectApp`) })

      /** Put the previous generation back and retire whatever it displaced. */
      const restore = async (): Promise<void> => {
        const displaced = options.swap(appId, await registerEffectApp(options.context, previous))
        if (displaced !== undefined) await displaced()
      }

      let dispose: Disposer
      try { dispose = await registerEffectApp(options.context, next) } catch (error) {
        await restore()
        return failed({ reason: "failed", error })
      }

      const report = assessSurfaceChange(surface, readAppSurface(options.context, appId), policy)
      if (!report.ok) {
        await dispose()
        await restore()
        return failed({ reason: "rejected", report })
      }

      // Commit. Retiring the displaced generation removes only what that generation
      // registered — every SDK disposer is identity- or generation-guarded.
      const displaced = options.swap(appId, dispose)
      if (displaced !== undefined) await displaced()
      await commit(root, appId, generation)
      return outcome(true, { report })
    },
  }
}
