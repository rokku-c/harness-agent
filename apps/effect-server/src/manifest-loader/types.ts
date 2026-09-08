import type { EffectAppHost } from "@effect-agent/effect-apps"
import type { EffectPluginHost } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"

export interface LoadContext extends EffectAppHost {
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
}
export type Disposer = () => Promise<void>
