/**
 * server/mount.ts - the MOUNT PREFIX, and the arithmetic it needs.
 *
 * Concept: one panel, two mounts. Standalone the console owns "/"; embedded
 * in the platform console the host mounts it at "/mantis". Two directions of
 * translation live here and nowhere else - an incoming URL to the path the
 * panel means, and the built markup's own "/app-shell.js" and "/api/..."
 * references to where they now resolve. Both are string arithmetic over one
 * prefix, which is why they are one file.
 */

/** "/mantis" -> "/mantis"; "" or "/" -> "" (the root mount) */
export const baseOf = (value: string | undefined): string =>
  value === undefined || value === "/" ? "" : "/" + value.replace(/^\/+|\/+$/g, "")

/** the path inside the mount, or undefined when this request is outside it */
export const internalPath = (path: string, base: string): string | undefined => base === "" || path === base
  ? base === "" ? path : "/"
  : path.startsWith(base + "/") ? path.slice(base.length) : undefined

/** rewrite one reference the built markup makes to one of its own files */
export const prefix = (body: string, base: string, name: string, kind: "href" | "src"): string =>
  base === "" ? body : body.replaceAll(`${kind}="${name}"`, `${kind}="${base}${name}"`)

/** rewrite the built bundle's own "/api/..." calls for the mount */
export const prefixApi = (body: string, base: string): string => base === ""
  ? body
  : body.replaceAll('"/api/', `"${base}/api/`).replaceAll("'/api/", `'${base}/api/`)
