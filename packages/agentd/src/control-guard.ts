import { AgentdError } from "./errors.ts"
import { sameToken } from "./same-token.ts"

export interface NodeGuard {
  readonly tokenRequired: boolean
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
