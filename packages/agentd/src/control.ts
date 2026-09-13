/**
 * The control plane, assembled: one state, three groups of verbs, and the status
 * view that spans them.
 *
 * The split is by layer, not by size — `control-state.ts` owns what is held,
 * `control-projections.ts` owns what a binding resolves to, and the verb files
 * own how state is written. This file is only the seam, so a verb can be found
 * by the question it answers: agent, deployment, or liveness.
 */

import { agentOps } from "./control-agent-ops.ts"
import { deploymentOps } from "./control-deployment-ops.ts"
import { livenessOps } from "./control-liveness-ops.ts"
import { makeControlState, type AgentdControlOptions } from "./control-state.ts"
import type { AgentdControl } from "./contract.ts"

export const makeAgentdControl = (options: AgentdControlOptions = {}): AgentdControl => {
  const control = makeControlState(options)
  return {
    ...agentOps(control),
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
