export interface UriParts {
  readonly scheme: string
  readonly segments: readonly string[]
}

export interface UriScheme {
  readonly scheme: string
  readonly render: (parts: UriParts) => string
  readonly parse: (uri: string) => UriParts | null
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
