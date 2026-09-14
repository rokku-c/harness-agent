import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"

import { principalKey } from "@effect-agent/effect-authz"

import { bearerToken, principalClaims, resolvePrincipal, type ResolvePrincipalInput } from "./resolve.ts"
import { hashToken } from "./token.ts"

export const authenticateRequest = (
  options: Pick<ResolvePrincipalInput, "tokens" | "principals">,
  request: Request,
): AuthInfo | undefined => {
  const token = bearerToken(request.headers)
  if (token === undefined) return undefined
  const resolved = resolvePrincipal({ ...options, headers: request.headers })
  if (resolved.principal === undefined) return undefined
  return {
    token: hashToken(token),
    clientId: principalKey(resolved.principal),
    scopes: [],
    extra: principalClaims(resolved.principal),
  }
}
