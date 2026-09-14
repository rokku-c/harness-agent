import type { Registry as McpRegistry } from "@effect-agent/mcp-registry"
import type { McpSetSlot } from "@effect-agent/mcp-gateway"
import type { EgressPolicy, EgressRouter, HttpSend } from "@effect-agent/effect-network"
import type { EffectPlugin, EffectPluginHost, RoutePattern } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"

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
  readonly path?: string
  readonly icon?: string
  readonly color?: string
  readonly requires?: readonly string[]
  readonly config?: unknown
  readonly ui?: EffectUiView
  readonly tools?: readonly unknown[]
  readonly plugin?: EffectPlugin
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
  readonly initializeConfig?: (appId: string) => void
  readonly activeConfig?: (appId: string) => unknown
}

export { registerEffectApp } from "./registration/register.ts"
export type { AsyncAppDisposer } from "./registration/disposal.ts"
export { assessSurfaceChange, readAppSurface } from "./registration/surface.ts"
export type { AppToolSurface } from "./registration/surface.ts"
