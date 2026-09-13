/**
 * The app layer, as §6.3-② and §6.5-6 need it: an ordered set of apps that can be
 * suspended and put back **by name** (docs/architecture-rework.md).
 *
 * Three things this model is deliberate about:
 *
 *  - **Suspended, not removed.** A suspension keeps the app's slot and gives up
 *    only its disposer, so restoring puts the app back where it was and `stop()`
 *    still tears the layer down in reverse load order — rather than in whatever
 *    order the last rebuild happened to append to.
 *  - **Loaded, not discoverable.** `declared()` reports what is actually running.
 *    A bundle in a directory this host never enabled declares nothing here, so no
 *    swap can suspend an app that was not up.
 *  - **One load path.** Restoring goes through the same `bootManifests` that boot
 *    used, narrowed by `only` — a rebuilt app cannot come back through a second,
 *    thinner registration path that drifts from the first.
 */

import type { DeclaredApp } from "@effect-agent/effect-bundle"
import { disposeAll } from "./dispose.ts"
import type { AppSlot, Disposer } from "../manifest-loader/types.ts"

export interface AppLayer {
  /** Load the layer from the manifests, once, at boot. */
  boot(): Promise<void>
  /** What §5's matrix adjudicates: the apps currently loaded, and what they declare. */
  declared(): readonly DeclaredApp[]
  /**
   * Every app in the layer, loaded or suspended, whether or not it declared a
   * bundle. `declared()` cannot answer this: it reports declarations, and an app
   * that ships no `effect.bundle.json` declares nothing while being very much
   * loaded. Reloading needs the apps, not the declarations.
   */
  appIds(): readonly string[]
  /** Suspend these apps (§6.5-6). Names that are not running are ignored. */
  suspend(apps: readonly string[]): Promise<void>
  /** Load these apps back into the slots they were suspended from. */
  restore(apps: readonly string[]): Promise<void>
  /** Every app currently running, for a full teardown at shutdown. */
  running(): readonly Disposer[]
  /**
   * Put a reloaded app into the slot it already occupies, handing back the
   * generation it displaced so the caller can retire that one once the new one
   * is live. A reload that left the boot-time disposer in the slot would have
   * `stop()` tear down a generation that stopped serving some time ago.
   */
  swap(appId: string, dispose: Disposer): Disposer | undefined
}

export interface AppLayerOptions {
  /** Load the apps named in `only` — or every enabled one, when absent. */
  readonly load: (only?: ReadonlySet<string>) => Promise<AppSlot[]>
}

export const makeAppLayer = (options: AppLayerOptions): AppLayer => {
  let slots: readonly AppSlot[] = []
  /** The slot an app keeps while it is suspended: same place, no running app. */
  const held = (slot: AppSlot): AppSlot =>
    ({ appId: slot.appId, ...(slot.declaration === undefined ? {} : { declaration: slot.declaration }) })
  return {
    boot: async () => { slots = await options.load() },
    appIds: () => slots.map((slot) => slot.appId),
    declared: () => slots.flatMap((slot) => slot.declaration === undefined
      ? []
      : [{ appId: slot.appId, declaration: slot.declaration }]),
    async suspend(apps) {
      const names = new Set(apps)
      const going = slots.flatMap((slot) =>
        names.has(slot.appId) && slot.dispose !== undefined ? [slot.dispose] : [])
      slots = slots.map((slot) => names.has(slot.appId) ? held(slot) : slot)
      await disposeAll(going.slice().reverse())
    },
    async restore(apps) {
      const back = new Map((await options.load(new Set(apps))).map((slot) => [slot.appId, slot]))
      const placed = new Set(slots.map((slot) => slot.appId))
      // Every suspended app has to come back, and come back *into a place in the
      // layer*. One that quietly did not — its directory is gone, or nothing ever
      // held a slot for it — would otherwise let a rebuild report a success that
      // is not one.
      const lost = apps.filter((appId) => !back.has(appId) || !placed.has(appId))
      if (lost.length > 0) throw new Error(`app layer could not restore ${lost.join(", ")}`)
      slots = slots.map((slot) => back.get(slot.appId) ?? slot)
    },
    running: () => slots.flatMap((slot) => slot.dispose === undefined ? [] : [slot.dispose]),
    swap(appId, dispose) {
      const index = slots.findIndex((slot) => slot.appId === appId)
      if (index === -1) return undefined
      const displaced = slots[index].dispose
      slots = slots.map((slot, at) => (at === index ? { ...slot, dispose } : slot))
      return displaced
    },
  }
}
