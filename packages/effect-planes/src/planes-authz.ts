/**
 * effect-planes — the baseline authorization for a node's own namespace.
 *
 * The planes' rule is the same one the old namespace comparison encoded: a
 * principal may do anything inside its own namespace, and nothing outside it
 * without an explicit grant. That baseline is a template, not a special case in
 * the read and write paths, so a cross-namespace grant and the self-rule are
 * weighed by one resolver — and an explicit deny can beat the self-rule.
 *
 * `principal.id` is the namespace, which is why `$self` is enough to say "my
 * own node" for a node in `ops`, a user in `ops`, or an agent in `ops`.
 */

import { ANY_SUBJECT, type Authz, type PolicyEntry, SELF, grantEntry, makeAuthz } from "@effect-agent/effect-authz"

/** The three kinds share one baseline: your own namespace, all planes. */
export const SELF_RULE = (): PolicyEntry =>
  grantEntry({ subject: ANY_SUBJECT, resource: SELF, actions: ["read", "call", "write"], source: "template" })

export const makePlanesAuthz = (): Authz => {
  const authz = makeAuthz()
  for (const kind of ["user", "app", "system"] as const) authz.setTemplate(kind, [SELF_RULE()])
  return authz
}
