/**
 * What the UI runtime's operations act on.
 *
 * The runtime is the one thing this app cannot be without; the rest are the
 * registries it was built with. They are named here rather than passed one at a
 * time so every operation takes the same thing, and so a host that has no
 * extension registry is a matter of construction rather than a shape each
 * declaration has to allow for.
 */
import type { ExtensionManifest } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "@effect-agent/ui-definition"
import type { UIRuntime } from "@effect-agent/ui-runtime"
import type { RendererRegistry } from "@effect-agent/ui-renderer"
import type { ActivityStore } from "../activity.ts"

/** An extension registry, read as what it has enabled. */
export interface ExtensionSource {
  list(): ReadonlyArray<ExtensionManifest>
}

export interface UiSurfaces {
  readonly runtime: UIRuntime
  readonly definitions: DefinitionStore
  readonly renderers: RendererRegistry
  readonly extensions: ExtensionSource
  readonly activity: ActivityStore
}
