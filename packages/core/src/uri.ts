/**
 * Uri: scheme-pluggable binding addressing.
 *
 * A Binding's uri is a plain string, but the *convention* that renders,
 * parses and normalizes uri strings is decoupled into UriScheme
 * implementations. Core ships the built-in "ea" scheme so everything works
 * out of the box; external code supplies its own schemes through a UriSpace
 * to define a completely custom uri convention without touching core.
 *
 * The only convention core keeps is: a scheme name + path segments. Any
 * richer meaning (registry/kind/identity or whatever an external system
 * needs) belongs to the scheme's user - that is the decoupling point.
 */

/** Structured parts of a uri. scheme + segments is the whole core vocabulary. */
export interface UriParts {
  readonly scheme: string
  readonly segments: readonly string[]
}

/**
 * One pluggable uri convention. A scheme knows how to render its parts into
 * a uri string, parse a string back into parts (or null when the uri is not
 * its own), and optionally normalize to a canonical form.
 */
export interface UriScheme {
  /** scheme name without the "://", e.g. "ea" */
  readonly scheme: string
  /** render parts into a uri string */
  readonly render: (parts: UriParts) => string
  /** parse a uri into parts; null when the uri does not belong to this scheme */
  readonly parse: (uri: string) => UriParts | null
  /** canonical form of one of its uris; defaults to render(parse(uri)) */
  readonly normalize?: (uri: string) => string
}

const enc = encodeURIComponent
const dec = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** The built-in "ea" scheme: ea://<segment>/<segment>/... (each segment uri-encoded). */
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

/**
 * A set of schemes forming one uri convention: renders by parts.scheme,
 * parses by trying every scheme in order, normalizes by round-tripping a
 * known uri through its scheme. Defaults to the built-in "ea" scheme;
 * external schemes are appended with extend().
 */
export class UriSpace {
  readonly #schemes: ReadonlyMap<string, UriScheme>
  constructor(schemes: readonly UriScheme[] = [eaScheme]) {
    this.#schemes = new Map(schemes.map((scheme) => [scheme.scheme, scheme]))
  }
  /** a new space with the given schemes appended (a later scheme wins on name clash) */
  readonly extend = (...more: readonly UriScheme[]): UriSpace =>
    new UriSpace([...this.#schemes.values(), ...more])
  /** render parts through the scheme named by parts.scheme; unknown scheme fails loud */
  readonly render = (parts: UriParts): string => {
    const scheme = this.#schemes.get(parts.scheme)
    if (scheme === undefined) {
      throw new Error(
        "UriSpace.render: unknown scheme '" + parts.scheme + "' (known: " + [...this.#schemes.keys()].join(", ") + ")"
      )
    }
    return scheme.render(parts)
  }
  /** parse a uri with the first scheme that claims it; null when none does */
  readonly parse = (uri: string): UriParts | null => {
    for (const scheme of this.#schemes.values()) {
      const parts = scheme.parse(uri)
      if (parts !== null) return parts
    }
    return null
  }
  /** canonical form of a uri its schemes claim; unchanged when none does */
  readonly normalize = (uri: string): string => {
    const parts = this.parse(uri)
    if (parts === null) return uri
    const scheme = this.#schemes.get(parts.scheme)
    return scheme?.normalize?.(uri) ?? this.render(parts)
  }
}

/** the default space: the built-in ea scheme only */
export const defaultUriSpace = new UriSpace()

/** render a uri in the built-in space: eaUri("board", "x") -> "ea://board/x" (empty segments are dropped) */
export const eaUri = (...segments: readonly string[]): string =>
  eaScheme.render({ scheme: "ea", segments: segments.filter((segment) => segment.length > 0) })

/**
 * Legacy convenience helpers over the built-in scheme (kept for source
 * compatibility with the earlier fixed-shape Uri.make).
 */
export const Uri = {
  /** ea://<registry>/<kind>/<identity>[/<subresource>] */
  make: (registry: string, kind: string, identity: string, subresource = ""): string =>
    eaUri(registry, kind, identity, subresource),
  /** true when the uri belongs to the built-in ea scheme */
  isEa: (uri: string): boolean => eaScheme.parse(uri) !== null
}
