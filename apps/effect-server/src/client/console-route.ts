export interface Address {
  readonly raw: string
  readonly parts: readonly string[]
  readonly query: URLSearchParams
}

export const decodePart = (value: string): string => { try { return decodeURIComponent(value) } catch { return value } }

export const parseAddress = (hash: string): Address => {
  const body = hash.startsWith("#") ? hash.slice(1) : hash
  const cut = body.indexOf("?")
  return {
    raw: hash,
    parts: (cut === -1 ? body : body.slice(0, cut)).split("/").filter((part) => part !== "").map(decodePart),
    query: new URLSearchParams(cut === -1 ? "" : body.slice(cut + 1)),
  }
}

export const paramsOf = (query: URLSearchParams): Readonly<Record<string, string>> => Object.fromEntries(query)

export interface ActivityFilter {
  readonly actor?: string
  readonly app?: string
  readonly kind?: string
  readonly since?: string
}

export const filtersOf = (query: URLSearchParams): ActivityFilter => {
  const one = (name: string): Record<string, string> => {
    const value = query.get(name)
    return value === null || value === "" ? {} : { [name]: value }
  }
  return { ...one("actor"), ...one("app"), ...one("kind"), ...one("since") }
}

export type UnresolvedPart = "place" | "app" | "screen"

export interface ConsoleDestination {
  readonly screen?: string
  readonly params?: Readonly<Record<string, string>>
}

export type ConsoleRoute =
  | { readonly kind: "home" }
  | { readonly kind: "inbox"; readonly decisionId?: string }
  | { readonly kind: "activity"; readonly filter: ActivityFilter }
  | { readonly kind: "tools"; readonly app?: string; readonly operation?: string }
  | { readonly kind: "settings"; readonly app?: string }
  | ({ readonly kind: "app"; readonly id: string } & ConsoleDestination)
  | { readonly kind: "app-settings"; readonly id: string }
  /** An address that resolves to nothing. It keeps the address, because that is the one fact a reader needs. */
  | { readonly kind: "not-found"; readonly address: string; readonly part: UnresolvedPart; readonly text: string; readonly app?: string }

export const unresolved = (address: Address, part: UnresolvedPart, text: string, app?: string): ConsoleRoute =>
  ({ kind: "not-found", address: address.raw, part, text, ...(app === undefined ? {} : { app }) })

export const parseDestination = (hash: string): ConsoleDestination => {
  const address = parseAddress(hash)
  if (address.parts[0] !== "app") return {}
  const screen = address.parts[2]
  const params = paramsOf(address.query)
  return { ...(screen === undefined ? {} : { screen }), ...(Object.keys(params).length === 0 ? {} : { params }) }
}
