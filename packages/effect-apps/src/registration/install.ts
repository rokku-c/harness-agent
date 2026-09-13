/**
 * One install attempt: register the incoming generation, adjudicate its surface
 * against the one it would displace, probe it, and report.
 *
 * Every failure path puts the displaced generation back. That is not symmetry
 * for its own sake: the host's `register()` replaces by plugin id and unloads
 * the previous entry itself (lifecycle.ts:26), so a throw here would otherwise
 * leave the app down with nothing serving it.
 *
 * What is *not* here is the history — which generation is live, what displaced
 * what. The slot (generations.ts) owns that and supplies the two seams this
 * needs: putting a generation back, and numbering the one that commits.
 */
import { defaultCompat } from "@effect-agent/effect-compat"
import type { EffectAppDescriptor, EffectAppHost } from "../descriptor.ts"
import type { AsyncAppDisposer } from "./disposal.ts"
import { registerEffectApp } from "./register.ts"
import { CLEAN, type AppGeneration, type InstallOptions, type InstallResult } from "./slot.ts"
import { assessSurfaceChange, readAppSurface } from "./surface.ts"

export interface InstallSite {
  readonly host: EffectAppHost
  readonly appId: string
  /** make a displaced generation serve again, after this attempt failed. */
  readonly restore: (generation: AppGeneration) => Promise<void>
  /** the number the committed generation carries — taken only on the path that commits. */
  readonly takeGeneration: () => number
}

/** Try to make `app` the live generation; `before` is what it would displace. */
export const installGeneration = async (
  site: InstallSite,
  before: AppGeneration | undefined,
  app: EffectAppDescriptor,
  options: InstallOptions,
): Promise<InstallResult> => {
  const policy = options.policy ?? defaultCompat

  let dispose: AsyncAppDisposer
  try {
    dispose = await registerEffectApp(site.host, app)
  } catch (error) {
    if (before !== undefined) await site.restore(before)
    return { ok: false, reason: "failed", report: CLEAN, error }
  }

  const surface = readAppSurface(site.host, site.appId)
  const report = before === undefined ? CLEAN : assessSurfaceChange(before.surface, surface, policy)
  if (!report.ok) {
    await dispose()
    if (before !== undefined) await site.restore(before)
    return { ok: false, reason: "rejected", report }
  }

  const generation: AppGeneration = {
    appId: site.appId,
    generation: site.takeGeneration(),
    descriptor: app,
    surface,
    dispose,
  }

  if (options.probe !== undefined) {
    try {
      await options.probe(generation)
    } catch (error) {
      await dispose()
      if (before !== undefined) await site.restore(before)
      return { ok: false, reason: "failed", report, error }
    }
  }

  return { ok: true, generation, report }
}
