/**
 * The console's client, rebuilt from source while the server runs.
 *
 * `bun run build:client` writes the bundle under `public/`, and that file is what
 * the console serves: a browser only ever runs code that exists on disk. That is
 * right for a built server and wrong for a running one, because the failure it
 * hides is the one hardest to see — an edit that never reached the browser looks
 * exactly like an edit that did not work, and the page goes on rendering last
 * revision's code with nothing anywhere saying so.
 *
 * So while `dev` is on, the bundle is built in this process on the first request
 * after a source moves. The staleness test is a timestamp walk rather than a
 * watcher: a watcher has to be told which trees matter and keeps its answer, and
 * the answer changes as the client grows. The walk covers every tree the client
 * compiles from, so a package the client imports counts as source too.
 *
 * The response is `no-store`. A browser cache in front of a rebuild would serve
 * the previous bundle and make the whole mechanism a no-op that reports success.
 */

import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const CLIENT = fileURLToPath(new URL("./client", import.meta.url))
const PACKAGES = fileURLToPath(new URL("../../../packages", import.meta.url))
const ENTRY = join(CLIENT, "effect-ui-client.tsx")

/** Which served path each built artifact answers for. */
const SERVED: Readonly<Record<string, { readonly type: string; readonly extension: string }>> = {
  "/console-client.js": { type: "text/javascript; charset=utf-8", extension: ".js" },
  "/console-client.css": { type: "text/css; charset=utf-8", extension: ".css" },
}

export interface ClientBundle {
  /** The bundle for one served path, rebuilt first if any source is newer. */
  serve(path: string): Promise<Response | undefined>
}

/** The newest write under a tree — the only thing that makes a build stale. */
const newest = async (dir: string): Promise<number> => {
  let at = 0
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) at = Math.max(at, entry.name === "node_modules" ? 0 : await newest(path))
    else if (/\.(ts|tsx|css)$/.test(entry.name)) at = Math.max(at, (await stat(path).catch(() => ({ mtimeMs: 0 }))).mtimeMs)
  }
  return at
}

export const makeClientBundle = (): ClientBundle => {
  let builtAt = 0
  let files = new Map<string, string>()

  const rebuild = async (): Promise<void> => {
    const result = await Bun.build({ entrypoints: [ENTRY], target: "browser", format: "esm" })
    if (!result.success) {
      // Reported as the response rather than thrown: the console page is still the
      // page that should have loaded, and a build error belongs next to it.
      throw new Error(result.logs.map((log) => log.message).join("\n"))
    }
    const next = new Map<string, string>()
    for (const output of result.outputs) {
      const extension = output.path.slice(output.path.lastIndexOf("."))
      const served = Object.keys(SERVED).find((path) => SERVED[path]!.extension === extension)
      if (served !== undefined) next.set(served, await output.text())
    }
    files = next
    builtAt = Date.now()
  }

  return {
    async serve(path) {
      const entry = SERVED[path]
      if (entry === undefined) return undefined
      const source = Math.max(await newest(CLIENT), await newest(PACKAGES))
      if (files.size === 0 || source > builtAt) {
        try { await rebuild() } catch (error) {
          return new Response(`console-client: build failed\n\n${error instanceof Error ? error.message : String(error)}`,
            { status: 500, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } })
        }
      }
      const body = files.get(path)
      return body === undefined
        ? new Response(null, { status: 404 })
        : new Response(body, { headers: { "content-type": entry.type, "cache-control": "no-store" } })
    },
  }
}
