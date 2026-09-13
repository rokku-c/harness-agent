import type { EffectAppHost } from "@effect-agent/effect-apps"
import type { BundleDeclaration } from "@effect-agent/effect-bundle"
import type { EffectPluginHost } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"

export interface LoadContext extends EffectAppHost {
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
}
export type Disposer = () => Promise<void>

/**
 * One place in the app layer, in load order (docs/architecture-rework.md §6.5-6).
 *
 * A slot outlives the app in it: suspending an app for a kernel swap gives up its
 * `dispose` and keeps its place, so restoring it puts it back where it was and
 * `stop()` still tears the layer down in reverse load order.
 */
export interface AppSlot {
  /** The app layer's own name for the app — `effect.yaml`'s `id`. */
  readonly appId: string
  /** Absent when the app shipped no `effect.bundle.json`: it declares nothing, so §5 never judges it. */
  readonly declaration?: BundleDeclaration
  /** Absent = suspended (§6.5-6): the place is held, the app is not running. */
  readonly dispose?: Disposer
}
