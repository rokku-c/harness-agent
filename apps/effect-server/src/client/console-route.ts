/**
 * The console's address grammar, and nothing else.
 *
 * `flows.md` §1.4 replaces `console-surface.md` §2 in full, and this file is that
 * replacement: one hash, split once into the parts every other module reads, and
 * one union naming what an address can mean. Which addresses actually exist
 * depends on what is registered, so nothing here resolves anything — that is
 * `console-places.ts`'s question, and keeping the two apart is what lets a stale
 * address stay a stale address instead of being quietly re-pointed at something
 * that does exist.
 */

/** A hash, split once. `#inbox/abc?x=1` is `["inbox", "abc"]` with `x=1` on the query. */
export interface Address {
  readonly raw: string
  readonly parts: readonly string[]
  readonly query: URLSearchParams
}

/**
 * A hash is a link, so its ids arrive encoded. A value that is not valid
 * encoding is taken as it stands rather than dropped: `#app/a%zz` names the app
 * `a%zz`, which is a not-found worth reporting, not an address worth losing.
 */
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

/** Parameters ride in a link, so a screen reads them as strings — a number arrives as its digits. */
export const paramsOf = (query: URLSearchParams): Readonly<Record<string, string>> => Object.fromEntries(query)

/** The four filters Activity carries in its address, so a filtered view is a link. */
export interface ActivityFilter {
  readonly actor?: string
  readonly app?: string
  readonly kind?: string
  readonly since?: string
}

/** H9's four filters, read off the address. Only the ones the address carries: an absent one is absent, not `undefined`. */
export const filtersOf = (query: URLSearchParams): ActivityFilter => {
  const one = (name: string): Record<string, string> => {
    const value = query.get(name)
    return value === null || value === "" ? {} : { [name]: value }
  }
  return { ...one("actor"), ...one("app"), ...one("kind"), ...one("since") }
}

/** What an address can fail to name, in the order H13 reports them: the place, then the app, then the screen. */
export type UnresolvedPart = "place" | "app" | "screen"

/** The screen and parameters an app's address names, on its own — the mounted view is what asks. */
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

/**
 * The destination an app's address names, read without the catalogue: the mounted
 * view already has its app id and is the only thing that asks. An address that is
 * not an app address names no screen, and the view falls back to its first.
 */
export const parseDestination = (hash: string): ConsoleDestination => {
  const address = parseAddress(hash)
  if (address.parts[0] !== "app") return {}
  const screen = address.parts[2]
  const params = paramsOf(address.query)
  return { ...(screen === undefined ? {} : { screen }), ...(Object.keys(params).length === 0 ? {} : { params }) }
}
