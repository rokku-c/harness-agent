/**
 * server/mount.ts - the MOUNT PREFIX, and the one translation it needs.
 *
 * Concept: one API, two mounts. Standalone the host owns "/"; embedded in the
 * platform console it is mounted at "/mantis". An incoming URL becomes the path
 * the API means here and nowhere else - string arithmetic over one prefix, which
 * is why it is one file.
 */

/** "/mantis" -> "/mantis"; "" or "/" -> "" (the root mount) */
export const baseOf = (value: string | undefined): string =>
  value === undefined || value === "/" ? "" : "/" + value.replace(/^\/+|\/+$/g, "")

/** the path inside the mount, or undefined when this request is outside it */
export const internalPath = (path: string, base: string): string | undefined => base === "" || path === base
  ? base === "" ? path : "/"
  : path.startsWith(base + "/") ? path.slice(base.length) : undefined
