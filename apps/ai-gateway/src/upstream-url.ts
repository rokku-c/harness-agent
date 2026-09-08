/** Preserve base path prefixes; an existing terminal /v1 overlaps the API route. */
export const upstreamURL = (baseURL: string, source: URL): URL => {
  const target = new URL(baseURL)
  const prefix = target.pathname.replace(/\/+$/, "")
  target.pathname = prefix + (prefix.endsWith("/v1") ? source.pathname.slice(3) : source.pathname)
  target.search = [target.search.slice(1), source.search.slice(1)].filter(Boolean).join("&")
  target.hash = ""
  return target
}
