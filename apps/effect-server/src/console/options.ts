import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"
import type { ConfigRuntime } from "../config-runtime/types.ts"

export interface ConsoleOptions {
  readonly registry: EffectRegistry
  readonly configs: ConfigRegistry
  readonly configRuntime?: ConfigRuntime
  /** Bootstrap-only seed for embedded hosts, not a runtime overlay. */
  readonly yamlOf?: (appId: string) => unknown
  readonly uiViews?: ReadonlyMap<string, EffectUiView>
  readonly uiHtml?: ReadonlyMap<string, string>
}
