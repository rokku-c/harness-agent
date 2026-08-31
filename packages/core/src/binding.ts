import { Effect } from "effect"
import type { Content } from "./content.ts"
import type { Op } from "./op.ts"

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

/** A container resolves bindings by uri - the runtime's capability table. */
export class Container {
  readonly #bindings: ReadonlyMap<string, Binding<any, any, any>>
  constructor(bindings: Iterable<Binding<any, any, any>>) {
    this.#bindings = new Map(Array.from(bindings, (binding) => [binding.uri, binding]))
  }
  get = (uri: string) => this.#bindings.get(uri)
  list = () => [...this.#bindings.values()]
}

/** A connection opens a container - the transport layer of capabilities. */
export interface Connection {
  readonly uri: string
  readonly open: Effect.Effect<Container, unknown, any>
}

/** The ea:// uri scheme: ea://<registry>/<kind>/<identity>[/<subresource>] */
export const Uri = {
  make: (registry: string, kind: string, identity: string, subresource = "") =>
    "ea://" + registry + "/" + kind + "/" + encodeURIComponent(identity) + (subresource ? "/" + subresource : "")
}

export interface Access<R = never> {
  readonly binding: Binding<any, any, R>
  readonly write: boolean
}

