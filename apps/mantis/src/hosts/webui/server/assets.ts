/**
 * server/assets.ts - the PANEL'S OWN FILES.
 *
 * Concept: the bundled panel - index.html, the built app-shell bundle, its
 * stylesheet - served out of one directory. The bundle is built once and must
 * work at "/" and at "/mantis", so the markup's references to its own files
 * and the bundle's "/api/..." calls are rewritten for the mount here.
 *
 * This is the standalone host's UI, and only its. The embedded app serves
 * api.ts and nothing else: the platform console renders mantis from its
 * declarative view (src/effect-ui.ts) in the console's own design system, so
 * serving a second, hand-written SPA inside it would be two front-ends over
 * one API.
 */
import { baseOf, internalPath, prefix, prefixApi } from "./mount.ts"
import { json, readAsset } from "./helpers.ts"

export interface PanelAssets {
  readonly publicDir: string
  /** host path prefix, for example "/mantis". Absent means root-mounted. */
  readonly basePath?: string
}

const ASSETS: ReadonlyArray<[string, string, string]> = [
  ["/", "index.html", "text/html; charset=utf-8"],
  ["/app-shell.js", "app-shell.js", "text/javascript"],
  ["/app-shell.css", "app-shell.css", "text/css"],
  ["/style.css", "style.css", "text/css"],
]

/** the file as the browser must receive it: every self-reference mount-prefixed */
const mounted = (base: string, name: string, body: string): string => {
  if (base === "" || name.endsWith(".css")) return body
  if (name !== "index.html") return prefixApi(body, base)
  return prefix(
    prefix(prefix(body, base, "/app-shell.css", "href"), base, "/style.css", "href"),
    base, "/app-shell.js", "src"
  )
}

/** the panel file this request names, or undefined when it names none */
export const panelAsset = (assets: PanelAssets, request: Request): Response | undefined => {
  if (request.method !== "GET") return undefined
  const base = baseOf(assets.basePath)
  const path = internalPath(new URL(request.url).pathname, base)
  const found = path === undefined ? undefined : ASSETS.find(([p]) => p === path)
  if (found === undefined) return undefined
  const body = readAsset(assets.publicDir, found[1])
  if (body === undefined) return json({ error: "asset not found" }, 404)
  return new Response(mounted(base, found[1], body), { headers: { "Content-Type": found[2] } })
}
