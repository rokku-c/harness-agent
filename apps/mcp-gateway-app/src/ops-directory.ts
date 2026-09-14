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
