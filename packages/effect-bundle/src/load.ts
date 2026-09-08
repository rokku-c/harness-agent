import type { EgressRouter } from "@effect-agent/effect-network"
/**
 * loadEffectBundle — load a compiled bundle "anywhere" and register it back.
 *
 * The bundle's compiled entry calls `register(api)` where `api` is whatever
 * the surrounding host exposes (host/registry/configs/ui). For an in-process
 * host this registers directly; a remote/embedded host passes an api that
 * forwards over the effect remote protocol instead. Loading always returns a
 * disposer.
 */

import { readFileSync } from "node:fs"
import { resolve, join } from "node:path"
import type { EffectPluginHost } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"
import type { EffectBundleManifest } from "./manifest.ts"

export interface EffectBundleApi {
  readonly network?: EgressRouter
  readonly host?: EffectPluginHost
  readonly registry: EffectRegistry
  readonly configs?: ConfigRegistry
  readonly uiViews?: Map<string, EffectUiView>
  /** optional override of the bundle's declared namespace (isolation). */
  readonly namespace?: string
  readonly initializeConfig?: (appId: string) => void
  readonly activeConfig?: (appId: string) => unknown
  readonly mcpRegistry?: import("@effect-agent/mcp-registry").Registry
}

export interface EffectBundleEntry {
  register?(api: EffectBundleApi): void | (() => void) | Promise<void | (() => void)>
}

type Disposer = () => void | Promise<void>

export const loadEffectBundle = async (bundleDir: string, api: EffectBundleApi): Promise<Disposer> => {
  const manifest: EffectBundleManifest = JSON.parse(readFileSync(join(bundleDir, "effect.bundle.json"), "utf8"))
  const entryPath = resolve(bundleDir, manifest.entry ?? "entry.js")
  const mod = (await import(entryPath)) as EffectBundleEntry
  if (mod.register === undefined) throw new Error("bundle entry has no register(api) export: " + manifest.bundleId)
  const disposer = await mod.register({ ...api, namespace: api.namespace ?? manifest.namespace })
  let disposed = false
  return async () => {
    if (disposed) return
    disposed = true
    if (typeof disposer === "function") await disposer()
  }
}
