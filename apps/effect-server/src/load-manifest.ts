/** Manifest loading is sequential and rollback-safe; app activation is awaited. */
import { resolve } from "node:path"
import { discoverManifests, type Discovered } from "./yaml-manifest.ts"
import { registerMcpPlugin } from "./registrar.ts"
import { loadInproc } from "./manifest-loader/inproc.ts"
import type { Disposer, LoadContext } from "./manifest-loader/types.ts"
export type { LoadContext } from "./manifest-loader/types.ts"

export const bootManifests = async (
  ctx: LoadContext, roots: readonly string[], enabled?: ReadonlySet<string>, onLoaded?: (d: Discovered) => void,
): Promise<Disposer[]> => {
  const disposers: Disposer[] = []
  try {
    for (const d of discoverManifests(roots)) {
      if (enabled && !enabled.has(d.manifest.id)) continue
      disposers.push(await loadManifest(ctx, d))
      onLoaded?.(d)
    }
    return disposers
  } catch (error) {
    for (const dispose of disposers.reverse()) {
      try { await dispose() } catch { /* retain the original boot failure */ }
    }
    throw error
  }
}

export const loadManifest = async (ctx: LoadContext, d: Discovered): Promise<Disposer> => {
  const m = d.manifest
  if (m.transport === "inproc") return loadInproc(ctx, d)
  return registerMcpPlugin(ctx.registry, {
    id: m.id, transport: m.transport, command: m.command,
    args: m.args?.map((a) => a.startsWith(".") ? resolve(d.dir, a) : a), url: m.url, headers: m.headers,
  })
}
