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
import { assertBundleCompat, BundleIncompatibleError, DEFAULT_RUNTIME, type EffectRuntimeKind } from "./compat.ts"
import { capabilityGaps, describeCapabilities, type RuntimeCapabilities } from "./capabilities.ts"

export interface EffectBundleApi {
  readonly network?: EgressRouter
  readonly host?: EffectPluginHost
  readonly registry: EffectRegistry
  readonly configs?: ConfigRegistry
  readonly uiViews?: Map<string, EffectUiView>
  /** optional override of the bundle's declared namespace (isolation). */
  readonly namespace?: string
  /** ABI this host implements; defaults to the SDK's kernel ABI (see compat.ts). */
  readonly abi?: string
  /** Runtime this host is — os | browser | sandbox; defaults to "os" (see §7). */
  readonly runtime?: EffectRuntimeKind
  /**
   * What this host can actually hand an app (§7.2). Absent = the host is not
   * declaring, and the `requires` check is skipped rather than guessed — the
   * same stance as `abi`, which also only gates when the host states it.
   */
  readonly capabilities?: RuntimeCapabilities
  readonly initializeConfig?: (appId: string) => void
  readonly activeConfig?: (appId: string) => unknown
  readonly mcpRegistry?: import("@effect-agent/mcp-registry").Registry
}

export interface EffectBundleEntry {
  register?(api: EffectBundleApi): void | (() => void) | Promise<void | (() => void)>
}

type Disposer = () => void | Promise<void>

/**
 * The capability half of the pre-import gate, in the same place as the abi and
 * runtime halves: an artifact whose declared needs this host cannot meet must
 * not execute a single line of its entry (§5, §7.4).
 *
 * Only checks what the artifact declares. Guessing needs from code is exactly
 * the "declaration nobody made" this repo refuses to treat as a declaration.
 */
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
  // Gate before importing anything: an incompatible artifact must not execute a
  // single line of its entry. Fail loud, never silently downgrade (§5, §7.4).
  assertBundleCompat(manifest, { abi: api.abi, runtime: api.runtime })
  assertCapabilityCompat(manifest, api.capabilities)
  // Pick the build for the runtime we are actually in (§7.5-2), falling back to
  // the primary entry so an artifact compiled before multi-target still loads.
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
