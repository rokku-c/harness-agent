import { Effect } from "effect"
import type { Content } from "./content.ts"
import type { Op } from "./op.ts"
import type { UriSpace } from "./uri.ts"

/**
 * A Binding is a named capability resource: something to read, or a set of
 * ops to call. Agents declare access to bindings; drivers materialize them.
 */
export interface Binding<A = never, E = never, R = never> {
  readonly uri: string
  readonly read?: Effect.Effect<Content, E, R>
  readonly typed?: Effect.Effect<A, E, R>
  readonly ops?: ReadonlyArray<Op<any, any, any, any>>
}

/**
 * How a query uri is resolved to a binding inside a Container. Decoupled so
 * external uri conventions can plug their own lookup: exact match by default,
 * or anything from normalization (UriSpace) to aliases to derived bindings.
 */
export type UriResolver = (
  uri: string,
  table: ReadonlyMap<string, Binding<any, any, any>>
) => Binding<any, any, any> | undefined

/** Default resolver: exact key lookup (the historical Container behavior). */
export const exactLookup: UriResolver = (uri, table) => table.get(uri)

/**
 * Resolver that normalizes the query uri with a uri space before lookup.
 * Register bindings with canonical uris; queries may then use any form the
 * space normalizes (encoding, case conventions, ...).
 */
export const normalizeLookup =
  (space: UriSpace): UriResolver =>
  (uri, table) =>
    table.get(space.normalize(uri))

/**
 * Resolver that matches by normalized identity on both sides of the table.
 * Cost is O(n) over registered bindings; use when query and registration
 * forms may differ (aliases, alternate spellings).
 */
export const canonicalLookup =
  (space: UriSpace): UriResolver =>
  (uri, table) => {
    const target = space.normalize(uri)
    for (const [key, binding] of table) {
      if (space.normalize(key) === target) return binding
    }
    return undefined
  }

/** A container resolves bindings by uri - the runtime's capability table. */
export class Container {
  readonly #bindings: ReadonlyMap<string, Binding<any, any, any>>
  readonly #resolve: UriResolver
  constructor(bindings: Iterable<Binding<any, any, any>>, resolve: UriResolver = exactLookup) {
    this.#bindings = new Map(Array.from(bindings, (binding) => [binding.uri, binding]))
    this.#resolve = resolve
  }
  get = (uri: string) => this.#resolve(uri, this.#bindings)
  list = () => [...this.#bindings.values()]
}

/** A connection opens a container - the transport layer of capabilities. */
export interface Connection {
  readonly uri: string
  readonly open: Effect.Effect<Container, unknown, any>
}

export interface Access<R = never> {
  readonly binding: Binding<any, any, R>
  readonly write: boolean
}
