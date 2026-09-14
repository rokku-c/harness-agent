import { agentOps } from "./control-agent-ops.ts"
import { configOps } from "./control-config-ops.ts"
import { deploymentOps } from "./control-deployment-ops.ts"
import { livenessOps } from "./control-liveness-ops.ts"
import { makeControlState, type AgentdControlOptions } from "./control-state.ts"
import type { AgentdControl } from "./contract.ts"

export const makeAgentdControl = (options: AgentdControlOptions = {}): AgentdControl => {
  const control = makeControlState(options)
  return {
    ...agentOps(control),
    ...configOps(control, options.gatewayUrl),
    ...deploymentOps(control),
    ...livenessOps(control),
    status: () => ({
      machines: [...control.machines.values()], agents: [...control.agents.values()], servers: [...control.servers.values()],
      sets: [...control.sets.values()], bundles: control.registry.list(), artifactIds: control.registry.artifactIds(),
      bindings: [...control.bindings.values()], nodes: [...control.nodes.values()].map((held) => held.binding),
      revision: control.revision(),
    }),
  }
}
