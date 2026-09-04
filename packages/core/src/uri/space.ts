/**
 * uri/space.ts - UriSpace: the pluggable uri-container.
 *
 * Concept: one uri convention is a SET of schemes. Render dispatches by
 * parts.scheme (unknown scheme fails loud); parse tries every scheme in
 * order; normalize round-trips a known uri through its own scheme. Defaults
 * to the built-in ea scheme; external schemes append with extend().
 */
import type { UriParts, UriScheme } from "./contract.ts"
import { eaScheme } from "./ea.ts"

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
