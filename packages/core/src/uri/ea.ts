/**
 * uri/ea.ts - the BUILT-IN "ea" scheme and its conveniences.
 *
 * Concept: ea://<segment>/<segment>/... with each segment uri-encoded - the
 * scheme every package gets out of the box. Also the fixed-shape legacy Uri
 * helpers kept for source compatibility.
 */
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
  /** ea://<registry>/<kind>/<identity>[/<subresource>] */
  make: (registry: string, kind: string, identity: string, subresource = ""): string =>
    eaUri(registry, kind, identity, subresource),
  /** true when the uri belongs to the built-in ea scheme */
  isEa: (uri: string): boolean => eaScheme.parse(uri) !== null
}
