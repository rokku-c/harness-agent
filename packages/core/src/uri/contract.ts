/**
 * uri/contract.ts - the URI CONVENTION contract.
 *
 * Concept: a Binding's uri is a plain string, but the convention that
 * renders/parses/normalizes it is decoupled into UriScheme implementations.
 * This file owns ONLY the contract (interfaces) plus the encoding helpers
 * schemes share. Core keeps no richer meaning than scheme + path segments:
 * registry/kind/identity belongs to each scheme's user.
 */
export interface UriParts {
  readonly scheme: string
  readonly segments: readonly string[]
}

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

export const enc = encodeURIComponent
export const dec = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
