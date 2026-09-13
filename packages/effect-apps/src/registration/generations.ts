/**
 * App generations — single-app hot replacement with per-app rollback
 * (docs/architecture-rework.md §6.4, §6.5-7).
 *
 * Why a single app can be swapped while its neighbours keep serving: every
 * registration the SDK makes is individually reversible AND identity-guarded.
 *
 *   - `effect-host` `register()` replaces by plugin id, unloading the previous
 *     entry itself (lifecycle.ts:26) — install order is "load next, retire old".
 *   - `EffectRegistry`'s disposer removes a record only if the identity still
 *     matches (registry.ts:83), so retiring the old one cannot delete the new.
 *   - `registerMap` keys disposal on a **generation token**, not the value
 *     (metadata.ts:6-18) — "replacement HTML/UI may be identical".
 *
 * So the swap itself is the host's existing replace-by-id. What a slot adds:
 * a retained previous generation, a health probe, and adjudication restored on
 * failure (install.ts) — plus the history behind "previous" and "rollback".
 */
import type { EffectAppDescriptor, EffectAppHost } from "../descriptor.ts"
import { installGeneration } from "./install.ts"
import { registerEffectApp } from "./register.ts"
import {
  CLEAN,
  type AppGeneration,
  type AppSlot,
  type AppSlotOptions,
  type InstallOptions,
  type InstallResult,
} from "./slot.ts"
import { readAppSurface } from "./surface.ts"

/**
 * A per-app slot over one host; several slots may share one, each app's
 * generation history independent — which is what makes a swap's blast radius
 * "one app, neighbours untouched".
 */
export const makeAppSlot = (
  host: EffectAppHost,
  appId: string,
  slotOptions: AppSlotOptions = {},
): AppSlot => {
  const gens: AppGeneration[] = []
  let nextGeneration = 1

  const current = (): AppGeneration | undefined => gens[gens.length - 1]
  const previous = (): AppGeneration | undefined => (gens.length > 1 ? gens[gens.length - 2] : undefined)

  /** Re-install `gen`'s descriptor and make it the live generation again. */
  const restore = async (gen: AppGeneration): Promise<void> => {
    const dispose = await registerEffectApp(host, gen.descriptor)
    const restored: AppGeneration = { ...gen, dispose, surface: readAppSurface(host, appId) }
    const index = gens.lastIndexOf(gen)
    if (index === -1) gens.push(restored)
    else gens[index] = restored
  }

  const site = { host, appId, restore, takeGeneration: () => nextGeneration++ }

  const install = async (app: EffectAppDescriptor, options: InstallOptions = {}): Promise<InstallResult> => {
    const before = current()
    const result = await installGeneration(site, before, app, options)
    if (!result.ok) return result

    // Commit. Retiring the old generation is safe *after* the new one is live:
    // every disposer it holds is identity- or generation-guarded, so it removes
    // only its own records, never the ones the new generation just wrote.
    if (before !== undefined) await before.dispose()
    gens.push(result.generation)
    await slotOptions.onChange?.(result.generation)
    return result
  }

  return {
    appId,
    current,
    previous,
    generations: () => [...gens],

    install,

    async rollback(options: InstallOptions = {}): Promise<InstallResult> {
      const target = previous()
      if (target === undefined) {
        return { ok: false, reason: "rejected", report: CLEAN, error: new Error(`no previous generation for "${appId}"`) }
      }
      // Rollback is install run backwards: the same adjudicator, the same probe,
      // the same restore-on-failure path (docs/script-sandbox.md §5.2).
      return install(target.descriptor, options)
    },

    async unload(): Promise<void> {
      const live = current()
      if (live === undefined) return
      gens.length = 0
      await live.dispose()
    },
  }
}
