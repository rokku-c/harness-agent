import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { readBundleManifest, type BundleDeclaration } from "@effect-agent/effect-bundle"
import { discoverManifests, type Discovered } from "./yaml-manifest.ts"
import { registerMcpPlugin } from "./registrar.ts"
import { loadInproc } from "./manifest-loader/inproc.ts"
import type { AppSlot, Disposer, LoadContext } from "./manifest-loader/types.ts"
export type { LoadContext } from "./manifest-loader/types.ts"

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
