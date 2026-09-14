import type { UriParts, UriScheme } from "./contract.ts"
import { eaScheme } from "./ea.ts"

export class UriSpace {
  readonly #schemes: ReadonlyMap<string, UriScheme>
  constructor(schemes: readonly UriScheme[] = [eaScheme]) {
    this.#schemes = new Map(schemes.map((scheme) => [scheme.scheme, scheme]))
  }
  readonly extend = (...more: readonly UriScheme[]): UriSpace =>
    new UriSpace([...this.#schemes.values(), ...more])
  readonly render = (parts: UriParts): string => {
    const scheme = this.#schemes.get(parts.scheme)
    if (scheme === undefined) {
      throw new Error(
        "UriSpace.render: unknown scheme '" + parts.scheme + "' (known: " + [...this.#schemes.keys()].join(", ") + ")"
      )
    }
    return scheme.render(parts)
  }
  readonly parse = (uri: string): UriParts | null => {
    for (const scheme of this.#schemes.values()) {
      const parts = scheme.parse(uri)
      if (parts !== null) return parts
    }
    return null
  }
  readonly normalize = (uri: string): string => {
    const parts = this.parse(uri)
    if (parts === null) return uri
    const scheme = this.#schemes.get(parts.scheme)
    return scheme?.normalize?.(uri) ?? this.render(parts)
  }
}

export const defaultUriSpace = new UriSpace()
