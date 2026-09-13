/**
 * The gateway config adapter: what one agent is told to run so that it can reach
 * the platform's one tool door (§F10).
 *
 * What it emits names the gateway and *presents a credential*. It deliberately
 * does not say who the agent is: identity at the door is what a verified
 * credential resolves to, never a field a config asserted, so a config that
 * carried its own agent id would be asking the door to believe a caller about
 * itself. That is why there is no `x-agent-id` here and no id in the headers —
 * the only thing that crosses is the credential the center was given for the
 * identity it bound, and a credential is one string for one principal.
 *
 * A credential is required rather than optional. The door refuses a request with
 * no credentials outright, so a config planned without one is a config that
 * cannot work, and handing an agent a file it will be turned away by is worse
 * than refusing to write it: the failure would surface at the agent, as a
 * refusal about sets, far from the operator who could have issued one.
 */

import { AgentdError } from "./errors.ts"
import { fail, record, sameKeys } from "./guards.ts"
import type { AgentAdapter, AgentInstance, AdapterPlan, DesiredAgentConfig } from "./types.ts"

export interface GatewayAgentConfig {
  readonly mcpServers: Readonly<Record<string, { readonly url: string; readonly headers: Readonly<Record<string, string>> }>>
  readonly metadata: { readonly agentId: string; readonly revision: number; readonly sets: readonly string[] }
}

const validUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:" } catch { return false }
}
/** A bearer header, carrying something. The door is the one that verifies a token. */
const bearer = (value: unknown): boolean => typeof value === "string" && value.startsWith("Bearer ") && value.length > "Bearer ".length

function validateGatewayConfig(config: unknown): asserts config is GatewayAgentConfig {
  const value: Record<string, unknown> = record(config) ? config : fail("invalid gateway config")
  if (!sameKeys(value, ["mcpServers", "metadata"])) fail("invalid gateway config")
  const servers: Record<string, unknown> = record(value.mcpServers) ? value.mcpServers : fail("invalid gateway config")
  const metadata: Record<string, unknown> = record(value.metadata) ? value.metadata : fail("invalid gateway config")
  const names = Object.keys(servers)
  if (names.length !== 1 || names[0] !== "effectGateway") fail("config must contain only effectGateway")
  const gateway: Record<string, unknown> = record(servers.effectGateway) ? servers.effectGateway : fail("invalid gateway server")
  if (!sameKeys(gateway, ["url", "headers"])) fail("invalid gateway server")
  const headers: Record<string, unknown> = record(gateway.headers) ? gateway.headers : fail("invalid gateway server")
  if (!validUrl(gateway.url)) fail("invalid gateway server")
  if (!sameKeys(headers, ["authorization"]) || !bearer(headers.authorization)) fail("invalid gateway credential header")
  if (!sameKeys(metadata, ["agentId", "revision", "sets"]) || typeof metadata.agentId !== "string" || metadata.agentId.length === 0 || typeof metadata.revision !== "number" || !Number.isInteger(metadata.revision) || metadata.revision < 0 || !Array.isArray(metadata.sets) || !metadata.sets.every((set: unknown) => typeof set === "string" && set.length > 0)) fail("invalid gateway metadata")
}
const assertAgent = (agent: AgentInstance, desired: DesiredAgentConfig): void => {
  if (!agent.agentId || desired.agent.agentId !== agent.agentId) fail("agent identity mismatch")
  if (!Number.isInteger(desired.revision) || desired.revision < 0) fail("invalid desired revision")
  if (!desired.sets.every((set) => typeof set.setId === "string" && set.setId.length > 0)) fail("invalid desired set")
}
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right)
const changesOf = (next: GatewayAgentConfig, previous?: GatewayAgentConfig): readonly string[] => {
  if (!previous) return ["create MCP Gateway configuration"]
  const changes: string[] = []
  if (next.mcpServers.effectGateway.url !== previous.mcpServers.effectGateway.url) changes.push("update MCP Gateway endpoint")
  if (!same(next.mcpServers.effectGateway.headers, previous.mcpServers.effectGateway.headers)) changes.push("update gateway credential")
  if (next.metadata.revision !== previous.metadata.revision) changes.push("update revision")
  if (!same(next.metadata.sets, previous.metadata.sets)) changes.push("update MCP set binding")
  return changes
}

export const makeGatewayConfigAdapter = (gatewayUrl: string): AgentAdapter<GatewayAgentConfig> => {
  if (!validUrl(gatewayUrl)) throw new AgentdError(400, "invalid MCP Gateway URL")
  return {
    kind: "mcp-gateway",
    validate: validateGatewayConfig,
    plan(agent: AgentInstance, desired: DesiredAgentConfig, reported?: unknown): AdapterPlan<GatewayAgentConfig> {
      assertAgent(agent, desired)
      const credential = desired.credential
      if (credential === undefined) fail(`agent ${agent.agentId} holds no MCP Gateway credential; issue one for that identity and declare it here`)
      let previous: GatewayAgentConfig | undefined
      if (reported !== undefined) {
        validateGatewayConfig(reported)
        if (reported.metadata.agentId !== agent.agentId) fail("reported agent identity mismatch")
        if (desired.revision < reported.metadata.revision) throw new AgentdError(409, "stale agent revision")
        previous = reported
      }
      const config: GatewayAgentConfig = { mcpServers: { effectGateway: { url: gatewayUrl, headers: { authorization: `Bearer ${credential}` } } }, metadata: { agentId: agent.agentId, revision: desired.revision, sets: desired.sets.map((set) => set.setId) } }
      validateGatewayConfig(config)
      return { agentId: agent.agentId, revision: desired.revision, desired: config, changes: changesOf(config, previous) }
    },
    async apply(plan: AdapterPlan<GatewayAgentConfig>): Promise<GatewayAgentConfig> {
      validateGatewayConfig(plan.desired)
      if (plan.agentId !== plan.desired.metadata.agentId || plan.revision !== plan.desired.metadata.revision) fail("invalid adapter plan")
      return plan.desired
    },
  }
}
