/**
 * What the UI runtime's operations act on.
 *
 * The runtime is the one thing this app cannot be without; the rest are the
 * registries it was built with. They are named here rather than passed one at a
 * time so every operation takes the same thing, and so a host that has no
 * extension registry is a matter of construction rather than a shape each
 * declaration has to allow for.
 *
 * The renderer registry is deliberately not one of them. It carried a choice
 * between two renderers for the same node vocabulary, and an operation that
 * takes it can switch how every canvas in the host is drawn; the host has one
 * renderer now, and nothing is asked to choose between one thing.
 */
import type { ExtensionManifest } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "@effect-agent/ui-definition"
import type { UIRuntime } from "@effect-agent/ui-runtime"
import type { ActivityStore } from "../activity.ts"

/** An extension registry, read as what it has enabled. */
export interface ExtensionSource {
  list(): ReadonlyArray<ExtensionManifest>
}

export interface UiSurfaces {
  readonly runtime: UIRuntime
  readonly definitions: DefinitionStore
  readonly extensions: ExtensionSource
  readonly activity: ActivityStore
}
