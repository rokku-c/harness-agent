import type { Registry as McpRegistry } from "@effect-agent/mcp-registry"
import type { McpSetSlot } from "@effect-agent/mcp-gateway"
import type { EgressPolicy, EgressRouter, HttpSend } from "@effect-agent/effect-network"
/** Standard app authoring contract; registration is awaited and reversible. */
import type { EffectPlugin, EffectPluginHost, RoutePattern } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"

/**
 * `mcpRegistry` is the platform's shared server registry; `mcpSets` is the seam
 * where the center that configures machines says where a set and a binding live.
 * Both are handed to every app and both are optional: an app that needs one says
 * so in `requires`, and the composition root is what satisfies it.
 */
export interface AppRuntimeContext {
  readonly fetch: HttpSend
  readonly mcpRegistry?: McpRegistry
  readonly mcpSets?: McpSetSlot
}

export interface EffectAppDescriptor {
  readonly routes?: readonly RoutePattern[]
  readonly egress?: EgressPolicy
  readonly id: string
  readonly title?: string
  readonly description?: string
  /** Prefix route served by the app (if any). It does not imply a UI surface. */
  readonly path?: string
  /**
   * How the host draws this app in its launcher: a short mark, and one of the
   * design system's own colour names. The app supplies both, so the host needs
   * no table of app ids and adding an app never means editing the host.
   */
  readonly icon?: string
  readonly color?: string
  readonly requires?: readonly string[]
  readonly config?: unknown
  readonly ui?: EffectUiView
  readonly tools?: readonly unknown[]
  readonly plugin?: EffectPlugin
  /** Preferred over plugin; the reader resolves live config on each call. */
  readonly createPlugin?: (getConfig: () => unknown, context: AppRuntimeContext) => EffectPlugin
}

export interface EffectAppHost {
  readonly network?: EgressRouter
  readonly mcpRegistry?: McpRegistry
  readonly mcpSets?: McpSetSlot
  readonly host?: EffectPluginHost
  readonly registry?: EffectRegistry
  readonly configs?: ConfigRegistry
  readonly uiViews?: Map<string, EffectUiView>
  /** Called after the config schema is registered, before metadata/plugin load. */
  readonly initializeConfig?: (appId: string) => void
  readonly activeConfig?: (appId: string) => unknown
}

export { registerEffectApp } from "./registration/register.ts"
export type { AsyncAppDisposer } from "./registration/disposal.ts"
/**
 * App *hot replacement* is not here. It is a whole mechanism — generations on
 * disk, adjudication, rollback — and it belongs to whoever runs the app: today
 * that is `apps/effect-server/src/boot/reload.ts`, over
 * `manifest-loader/generation.ts`. This package supplies what that needs
 * (`registerEffectApp` above, and the two surface readings below) and no second
 * copy of the swap.
 */
export { assessSurfaceChange, readAppSurface } from "./registration/surface.ts"
export type { AppToolSurface } from "./registration/surface.ts"
