import { Effect } from "effect"
import type { Content } from "./content.ts"
import type { Op } from "./op.ts"
import type { UriSpace } from "./uri.ts"

export interface Binding<A = never, E = never, R = never> {
  readonly uri: string
  readonly read?: Effect.Effect<Content, E, R>
  readonly typed?: Effect.Effect<A, E, R>
  readonly ops?: ReadonlyArray<Op<any, any, any, any>>
}

export type UriResolver = (
  uri: string,
  table: ReadonlyMap<string, Binding<any, any, any>>
) => Binding<any, any, any> | undefined

export const exactLookup: UriResolver = (uri, table) => table.get(uri)

export const normalizeLookup =
  (space: UriSpace): UriResolver =>
  (uri, table) =>
    table.get(space.normalize(uri))

export const canonicalLookup =
  (space: UriSpace): UriResolver =>
  (uri, table) => {
    const target = space.normalize(uri)
    for (const [key, binding] of table) {
      if (space.normalize(key) === target) return binding
    }
    return undefined
  }

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

export interface Connection {
  readonly uri: string
  readonly open: Effect.Effect<Container, unknown, any>
}

export interface Access<R = never> {
  readonly binding: Binding<any, any, R>
  readonly write: boolean
}
