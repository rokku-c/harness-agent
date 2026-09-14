import type { EgressRouter } from "@effect-agent/effect-network"

import { readFileSync } from "node:fs"
import { resolve, join } from "node:path"
import type { EffectPluginHost } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"
import type { EffectBundleManifest } from "./manifest.ts"
import { assertBundleCompat, BundleIncompatibleError, DEFAULT_RUNTIME, type EffectRuntimeKind } from "./compat.ts"
import { capabilityGaps, describeCapabilities, type RuntimeCapabilities } from "./capabilities.ts"

export interface EffectBundleApi {
  readonly network?: EgressRouter
  readonly host?: EffectPluginHost
  readonly registry: EffectRegistry
  readonly configs?: ConfigRegistry
  readonly uiViews?: Map<string, EffectUiView>
  readonly namespace?: string
  readonly abi?: string
  readonly runtime?: EffectRuntimeKind
  readonly capabilities?: RuntimeCapabilities
  readonly initializeConfig?: (appId: string) => void
  readonly activeConfig?: (appId: string) => unknown
  readonly mcpRegistry?: import("@effect-agent/mcp-registry").Registry
  readonly mcpSets?: import("@effect-agent/mcp-gateway").McpSetSlot
}

export interface EffectBundleEntry {
  register?(api: EffectBundleApi): void | (() => void) | Promise<void | (() => void)>
}

type Disposer = () => void | Promise<void>

export const assertCapabilityCompat = (
  manifest: Pick<EffectBundleManifest, "bundleId" | "requires">,
  capabilities: RuntimeCapabilities | undefined,
): void => {
  const required = manifest.requires ?? []
  if (capabilities === undefined || required.length === 0) return
  const gaps = capabilityGaps(required, capabilities)
  if (gaps.length === 0) return
  throw new BundleIncompatibleError(manifest.bundleId, {
    code: "capability-missing",
    required: gaps.join(", "),
    provided: describeCapabilities(capabilities),
    message: `bundle "${manifest.bundleId}" requires [${gaps.join(", ")}] but this host is ${describeCapabilities(capabilities)}`,
  })
}

export const loadEffectBundle = async (bundleDir: string, api: EffectBundleApi): Promise<Disposer> => {
  const manifest: EffectBundleManifest = JSON.parse(readFileSync(join(bundleDir, "effect.bundle.json"), "utf8"))
  assertBundleCompat(manifest, { abi: api.abi, runtime: api.runtime })
  assertCapabilityCompat(manifest, api.capabilities)
  const runtime = api.runtime ?? DEFAULT_RUNTIME
  const entryPath = resolve(bundleDir, manifest.entries?.[runtime] ?? manifest.entry ?? "entry.js")
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
