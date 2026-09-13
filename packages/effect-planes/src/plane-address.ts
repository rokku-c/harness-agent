/**
 * effect-planes — where a plane scope lives in the resource grammar.
 *
 * Each plane gets its own scheme, so a grant on one plane cannot open another:
 * `store://ops/board` and `ui://ops/board` are different resources even though
 * they are the same node. A scheme-less grant still reaches all of them, which
 * is what lets one `$self` rule cover a principal's own node across every plane.
 *
 * A namespace-level address (`store://ops`, no appId) is the question `can`
 * asks; a node-level address is what an actual read or write checks. A literal
 * grant on the former covers the latter, so granting a namespace opens the
 * nodes inside it.
 */

import { type Action, type Resource, asResource, forPlaneScope } from "@effect-agent/effect-authz"

import type { PlaneScope } from "./types.ts"

const SCHEME: Readonly<Record<PlaneScope, string>> = {
  interface: "iface",
  ui: "ui",
  store: "store",
  "store-write": "store",
}

export const planeAddress = (scope: PlaneScope, ns: string, appId?: string): Resource =>
  asResource(`${SCHEME[scope]}://${ns}${appId === undefined ? "" : `/${appId}`}`)

/** interface → call, store-write → write, ui/store → read. */
export const planeAction = (scope: PlaneScope): Action => forPlaneScope(scope)

export const PLANE_SCOPES: readonly PlaneScope[] = ["interface", "ui", "store", "store-write"]
