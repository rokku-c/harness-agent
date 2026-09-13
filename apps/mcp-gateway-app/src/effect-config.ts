import { z, type ConfigDeclaration } from "@effect-agent/effect-config"
import { parsePrincipalKey } from "@effect-agent/effect-authz"
import { mcpSetBindingSchema as binding, mcpSetSchema as set, unknownName } from "@effect-agent/mcp-gateway"

/**
 * Two things a field shape cannot say, said here while the operator is looking
 * at the form — because a config the gateway refuses at load is an app that
 * never comes up and names nothing.
 *
 * A binding is keyed by the identity the door verified, so it is keyed by a
 * principal key: `app:builder-2`, not `builder-2`. A key without its kind is
 * ambiguous between a user and an app of the same name, and a binding nobody
 * resolves is a binding that silently reaches nothing.
 *
 * A binding to a set nobody declares authorizes nothing; the registry refuses
 * it by throwing, so the grammar refuses it first and names the binding.
 *
 * There is no `defaultAction` here. The sets already decide what an agent may
 * reach, and a second knob that could deny an authorized call is a second
 * verdict on one question — the inconsistency this app exists to prevent.
 */
const schema = z.object({
  sets: z.array(set).default([]), bindings: z.array(binding).default([]),
  databaseFile: z.string().min(1).default(".effect-agent/mcp-gateway.sqlite"),
  captureArgs: z.boolean().default(false),
}).strict().superRefine((value, ctx) => {
  const declared = new Set(value.sets.map((one) => one.setId))
  for (const bind of value.bindings) {
    if (parsePrincipalKey(bind.agentId) === undefined) {
      ctx.addIssue({ code: "custom", path: ["bindings"], message: `${bind.agentId} is not a principal key; write it as kind:id, e.g. app:${bind.agentId}` })
      continue
    }
    const unknown = unknownName(bind.setIds, (setId) => declared.has(setId))
    if (unknown !== undefined) {
      ctx.addIssue({ code: "custom", path: ["bindings"], message: `${bind.agentId} is bound to ${unknown}, which is not a configured set` })
    }
  }
})
export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "mcp-gateway", title: "mcp-gateway", description: "MCP Gateway sets, agent bindings and identities", schema,
}
