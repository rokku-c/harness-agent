import { z } from "@effect-agent/effect-config"
import { OperationFault, operation, type Operation } from "@effect-agent/effect-interface"
import { principalKey } from "@effect-agent/effect-authz"
import { given, identityOf, ttlMs, type IdentitySurfaces } from "./identity-input.ts"

export const tokenOperations = (surfaces: IdentitySurfaces): readonly Operation[] => [
  operation({
    name: "mcp_gateway_issue_token",
    description: "Register an identity if it is new and issue a bearer token for it; the token is answered once and stored only as its hash",
    input: z.object({
      kind: z.string(),
      id: z.string(),
      displayName: z.string().optional(),
      ttlDays: z.union([z.string(), z.number()]).optional(),
    }).strict(),
    http: { method: "POST", path: "/mcp-gateway/tokens", status: 201 },
    handler: (input) => {
      const identity = identityOf(input.kind, given(input.id))
      const key = principalKey(identity)
      const displayName = given(input.displayName)
      const ttl = ttlMs(input.ttlDays)
      const before = surfaces.principals.get(key)
      surfaces.principals.register({ ...identity, ...(displayName === undefined ? {} : { displayName }) })
      const issued = surfaces.tokens.issue({ principalKey: key, ...(ttl === undefined ? {} : { ttlMs: ttl }) })
      const expiresAt = issued.record.expiresAt
      return {
        ok: true,
        token: issued.token,
        tokenHash: issued.record.tokenHash,
        fingerprint: issued.record.tokenHash.slice(0, 8),
        principalKey: key,
        reactivated: before?.status === "disabled",
        ...(expiresAt === undefined ? {} : { expires: new Date(expiresAt).toISOString() }),
      }
    },
  }),
  operation({
    name: "mcp_gateway_revoke_token",
    description: "Revoke one token by the hash its listing reports; revocation is final, so a credential that should be restorable is turned off with its identity instead",
    input: z.object({ tokenHash: z.string() }).strict(),
    http: { method: "POST", path: "/mcp-gateway/tokens/revoke" },
    handler: (input) => {
      const tokenHash = given(input.tokenHash)
      if (tokenHash === undefined) throw new OperationFault(400, "a token hash is required")
      if (!surfaces.tokens.revoke(tokenHash)) throw new OperationFault(404, "no active token with that hash")
      return { ok: true, tokenHash }
    },
  }),
]
