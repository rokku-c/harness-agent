/**
 * A deployed app, as §6.3 has to handle it: a declaration (`effect.bundle.json`,
 * which is what the §5 matrix reads) plus a plugin answering one route — laid out
 * on disk the way `bootManifests` discovers it.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/**
 * The app's own source. It reports into the *same* global log the kernel fixture
 * uses, on purpose: ②'s defining property is an ordering — the apps come down
 * before the new kernel goes up — and two separate logs could not show that.
 */
export const appSource = (id: string, route = "/demo"): string => `
const log = (entry) => (globalThis.__effectKernelLog ??= []).push(entry)

export const effectApp = {
  id: ${JSON.stringify(id)},
  plugin: {
    id: ${JSON.stringify(id)},
    priority: 100,
    load: async () => {
      log("load:" + ${JSON.stringify(id)})
      return {
        canHandle: (path) => path === ${JSON.stringify(route)},
        handle: async () => new Response(${JSON.stringify(id)}),
        stop: async () => { log("stop:" + ${JSON.stringify(id)}) },
      }
    },
  },
}
`

export interface AppSpec {
  readonly id: string
  /**
   * The `effect-N` line this app declares, by shipping an `effect.bundle.json`.
   * Absent = the app ships no bundle, so it declares nothing and §5 never judges
   * it — which is how most deployed apps look today, and the case §6.5-6 spares.
   */
  readonly abi?: string
  /** The one route this app answers. */
  readonly route?: string
}

/** Write one app under `root`, in the layout the manifest loader discovers. */
export const writeApp = (root: string, app: AppSpec): void => {
  const dir = join(root, app.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "effect.yaml"), `id: ${app.id}\ntransport: inproc\nmodule: ./app.js\n`)
  writeFileSync(join(dir, "app.js"), appSource(app.id, app.route))
  if (app.abi !== undefined) {
    writeFileSync(join(dir, "effect.bundle.json"),
      JSON.stringify({ bundleId: `io.effect-agent.${app.id}@1.0.0`, appId: app.id, abi: app.abi, runtimes: ["os"] }))
  }
}
