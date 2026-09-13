import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

/**
 * What is the gateway's own to say, and nothing else.
 *
 * A set and a binding are *not* here. They are declared in the center that
 * configures machines — where the identity that a binding is keyed by is issued
 * — and this app reads them from there, so there is one home and one surface
 * that writes it. A second declaration here would be the same fact with two
 * authors and nothing keeping them in step, which is exactly the shape that
 * left an operator's `agentd_bind` invisible on this console.
 *
 * There is no `defaultAction` either. The sets decide what an agent may reach,
 * and a second knob that could deny an authorized call is a second verdict on
 * one question — the inconsistency this app exists to prevent.
 */
const schema = z.object({
  databaseFile: z.string().min(1).default(".effect-agent/mcp-gateway.sqlite"),
  captureArgs: z.boolean().default(false),
}).strict()
export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "mcp-gateway", title: "mcp-gateway", description: "MCP Gateway identities and audit; the sets it enforces are agentd's",
  schema,
}
