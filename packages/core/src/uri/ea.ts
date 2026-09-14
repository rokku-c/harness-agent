import { dec, enc, type UriParts, type UriScheme } from "./contract.ts"

export const eaScheme: UriScheme = {
  scheme: "ea",
  render: (parts) => "ea://" + parts.segments.map(enc).join("/"),
  parse: (uri) => {
    if (!uri.startsWith("ea://")) return null
    const segments = uri
      .slice("ea://".length)
      .split("/")
      .filter((segment) => segment.length > 0)
      .map(dec)
    return { scheme: "ea", segments }
  }
}

export const eaUri = (...segments: readonly string[]): string =>
  eaScheme.render({ scheme: "ea", segments: segments.filter((segment) => segment.length > 0) })

export const Uri = {
  make: (registry: string, kind: string, identity: string, subresource = ""): string =>
    eaUri(registry, kind, identity, subresource),
  isEa: (uri: string): boolean => eaScheme.parse(uri) !== null
}
