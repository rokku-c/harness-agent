/** Manifest loading is sequential and rollback-safe; app activation is awaited. */
import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { readBundleManifest, type BundleDeclaration } from "@effect-agent/effect-bundle"
import { discoverManifests, type Discovered } from "./yaml-manifest.ts"
import { registerMcpPlugin } from "./registrar.ts"
import { loadInproc } from "./manifest-loader/inproc.ts"
import type { AppSlot, Disposer, LoadContext } from "./manifest-loader/types.ts"
export type { LoadContext } from "./manifest-loader/types.ts"

/**
 * What an app declares to §5's matrix — read from `effect.bundle.json`, because
 * that is where a bundle states its ABI. Not guessed from the app's name or its
 * loaded surface. `a declaration nobody made is not a declaration`, so an app
 * with no bundle file declares nothing and the matrix never judges it.
 *
 * The bundle also has to agree about *which app it is*. §6.5-6 suspends an app by
 * the app layer's name; a bundle whose `appId` names something else would have a
 * swap suspending the wrong one, so the disagreement is refused here rather than
 * resolved by picking a winner.
 */
export const declarationOf = (dir: string, appId: string): BundleDeclaration | undefined => {
  if (!existsSync(join(dir, "effect.bundle.json"))) return undefined
  const manifest = readBundleManifest(dir, { readFileSync: (path) => readFileSync(path, "utf8") })
  if (manifest.appId !== appId) {
    throw new Error(`${dir} ships a bundle calling itself ${manifest.appId}, but its manifest calls it ${appId}`)
  }
  return {
    bundleId: manifest.bundleId,
    abi: manifest.abi,
    ...(manifest.runtimes === undefined ? {} : { runtimes: manifest.runtimes }),
  }
}

export const bootManifests = async (
  ctx: LoadContext, roots: readonly string[], enabled?: ReadonlySet<string>, only?: ReadonlySet<string>,
): Promise<AppSlot[]> => {
  const slots: AppSlot[] = []
  try {
    for (const d of discoverManifests(roots)) {
      const appId = d.manifest.id
      // Two questions, deliberately separate: `enabled` is whether this host runs
      // the app at all, `only` is whether *this call* is the one that loads it.
      if (enabled && !enabled.has(appId)) continue
      if (only && !only.has(appId)) continue
      const declaration = declarationOf(d.dir, appId)
      slots.push({
        appId,
        ...(declaration === undefined ? {} : { declaration }),
        dispose: await loadManifest(ctx, d),
      })
    }
    return slots
  } catch (error) {
    for (const slot of slots.reverse()) {
      try { await slot.dispose?.() } catch { /* retain the original boot failure */ }
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
