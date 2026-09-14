import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"
import type { ConfigRuntime } from "../config-runtime/types.ts"

export interface ConsoleOptions {
  readonly registry: EffectRegistry
  readonly configs: ConfigRegistry
  readonly configRuntime?: ConfigRuntime
  readonly yamlOf?: (appId: string) => unknown
  readonly uiViews?: ReadonlyMap<string, EffectUiView>
  readonly dev?: boolean
}
