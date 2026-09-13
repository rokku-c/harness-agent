/**
 * The door's authentication, in the shape the transport asks for it.
 *
 * `serveMcpHttp` wants an `AuthInfo` for each request and hands it to the tool
 * handlers; the gateway already knows how to get one — read the bearer token,
 * verify it against the store, check the directory, produce a principal. This is
 * that answer restated for the transport, so an app states which stores it has
 * and nothing about how a bearer token is read.
 *
 * The transport's shape carries two fields this door has no use for, and both
 * are filled with what is true rather than with what would look right: the
 * scopes are empty, because access here is decided by mcpset and never by scope,
 * and the token is the record's hash rather than the secret — the plaintext is
 * the caller's, and nothing downstream can do with it that the claims below do
 * not already say.
 *
 * Only a bearer token identifies anyone here. Something that carries none is a
 * stranger however it is addressed, which is why this takes the two stores and
 * not the whole resolving surface: `trusted` and `claims` are for a transport
 * that already verified something, and the HTTP door is the one that has not.
 *
 * Returning `undefined` is not "no authentication happened" — it is the door
 * saying it could not name a caller, and everything downstream then treats the
 * request as a stranger. A door that resolved a principal would have to be wrong
 * twice for that to become an access.
 */
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
