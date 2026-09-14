import type { DeclaredApp } from "@effect-agent/effect-bundle"
import { disposeAll } from "./dispose.ts"
import type { AppSlot, Disposer } from "../manifest-loader/types.ts"

export interface AppLayer {
  boot(): Promise<void>
  declared(): readonly DeclaredApp[]
  appIds(): readonly string[]
  suspend(apps: readonly string[]): Promise<void>
  restore(apps: readonly string[]): Promise<void>
  running(): readonly Disposer[]
  swap(appId: string, dispose: Disposer): Disposer | undefined
}

export interface AppLayerOptions {
  readonly load: (only?: ReadonlySet<string>) => Promise<AppSlot[]>
}

export const makeAppLayer = (options: AppLayerOptions): AppLayer => {
  let slots: readonly AppSlot[] = []
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
