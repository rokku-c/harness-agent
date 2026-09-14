import type { ExtensionManifest } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "@effect-agent/ui-definition"
import type { UIRuntime } from "@effect-agent/ui-runtime"
import type { ActivityStore } from "../activity.ts"

export interface ExtensionSource {
  list(): ReadonlyArray<ExtensionManifest>
}

export interface UiSurfaces {
  readonly runtime: UIRuntime
  readonly definitions: DefinitionStore
  readonly extensions: ExtensionSource
  readonly activity: ActivityStore
}
