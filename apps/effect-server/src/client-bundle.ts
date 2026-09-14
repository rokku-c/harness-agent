import { readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const CLIENT = fileURLToPath(new URL("./client", import.meta.url))
const PACKAGES = fileURLToPath(new URL("../../../packages", import.meta.url))
const ENTRY = join(CLIENT, "effect-ui-client.tsx")

const SERVED: Readonly<Record<string, { readonly type: string; readonly extension: string }>> = {
  "/console-client.js": { type: "text/javascript; charset=utf-8", extension: ".js" },
  "/console-client.css": { type: "text/css; charset=utf-8", extension: ".css" },
}

export interface ClientBundle {
  serve(path: string): Promise<Response | undefined>
}

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
