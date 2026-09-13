/**
 * Who the door can name, and whether each of them is on.
 *
 * The listing answers the directory and its credentials at once, because that is
 * how it is read: an identity with no token is one nobody can present, and a
 * token whose identity is off is one that no longer opens anything, so either
 * list alone is half a fact. One read also means the screen says "this failed"
 * once instead of twice.
 *
 * Turning an identity off is a flag rather than a deletion: it keeps every token
 * it holds and refuses all of them at the door, and turning it back on restores
 * exactly what was there. That is the reversible half of cutting someone off;
 * `ops-token.ts` is the other.
 */
import { z } from "@effect-agent/effect-config"
import { OperationFault, noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { principalKey } from "@effect-agent/effect-authz"
import { principalRow, tokenRow } from "./identity-rows.ts"
import { given, identityOf, type IdentitySurfaces } from "./identity-input.ts"

export const directoryOperations = (surfaces: IdentitySurfaces): readonly Operation[] => [
  operation({
    name: "mcp_gateway_identities",
    description: "The identities the door can verify: the principal directory, and every token issued to it, newest first",
    access: "read", input: noInput, http: { method: "GET", path: "/mcp-gateway/identities" },
    handler: () => {
      const at = Date.now()
      return {
        ok: true,
        principals: surfaces.principals.list().map(principalRow),
        tokens: surfaces.tokens.list().map((record) => tokenRow(record, at)),
      }
    },
  }),
  operation({
    name: "mcp_gateway_set_principal_status",
    description: "Turn an identity on or off; off refuses every token it holds without revoking any of them, and is reversible",
    input: z.object({ kind: z.string(), id: z.string(), status: z.enum(["active", "disabled"]) }).strict(),
    http: { method: "POST", path: "/mcp-gateway/principals/status" },
    handler: (input) => {
      const key = principalKey(identityOf(input.kind, given(input.id)))
      if (!surfaces.principals.setStatus(key, input.status)) throw new OperationFault(404, `${key} is not in the directory`)
      return { ok: true, key, status: input.status }
    },
  }),
]
