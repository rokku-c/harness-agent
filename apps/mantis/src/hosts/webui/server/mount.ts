export const baseOf = (value: string | undefined): string =>
  value === undefined || value === "/" ? "" : "/" + value.replace(/^\/+|\/+$/g, "")

export const internalPath = (path: string, base: string): string | undefined => base === "" || path === base
  ? base === "" ? path : "/"
  : path.startsWith(base + "/") ? path.slice(base.length) : undefined
