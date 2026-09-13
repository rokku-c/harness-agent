/**
 * One credential check for every node-facing verb (§8.5-1).
 *
 * Kept apart from the state it guards because it is *policy*, not storage: the
 * token is one secret compared in one place, and a second copy of this
 * comparison would be a second place to get it wrong — with the failure silent
 * in exactly one of them.
 *
 * An absent token means the guard is not armed, and `tokenRequired` says so out
 * loud rather than leaving a caller to infer it from the config (§8.5-1).
 */

import { AgentdError } from "./errors.ts"
import { sameToken } from "./same-token.ts"

export interface NodeGuard {
  /** Whether a credential is currently required at all. */
  readonly tokenRequired: boolean
  /** Whether a presented token opens the node-facing verbs, when one is armed. */
  authorized(token: string | undefined): boolean
  authorizeNode(nodeId: string, token: string | undefined): void
}

export const makeNodeGuard = (nodeToken: string | undefined): NodeGuard => {
  const authorized = (token: string | undefined): boolean =>
    nodeToken === undefined || (token !== undefined && sameToken(token, nodeToken))
  return {
    tokenRequired: nodeToken !== undefined,
    authorized,
    authorizeNode: (nodeId, token) => { if (!authorized(token)) throw new AgentdError(401, `unauthorized node ${nodeId}`) },
  }
}
