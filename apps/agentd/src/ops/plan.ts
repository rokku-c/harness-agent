/**
 * The two plans, and the records they are built from.
 *
 * Building a plan is where runtime/abi is adjudicated (§7.6 / §5), so a caller
 * who only reads one learns the same verdict the executing machine would.
 */
import { AgentdError, makeBundleArtifactAdapter, makeNodeArtifactAdapter, type AgentdControl } from "@effect-agent/agentd"

type AgentRecord = ReturnType<AgentdControl["desired"]>["agent"]

/** The agent record as the adapters want it, read back from the control plane. */
export const agentOf = (control: AgentdControl, agentId: string): AgentRecord => {
  const status = control.status() as { readonly agents?: readonly AgentRecord[] }
  const agent = (status.agents ?? []).find((candidate) => candidate.agentId === agentId)
  if (agent === undefined) throw new AgentdError(404, "agent not found")
  return agent
}

export const bundlePlan = (control: AgentdControl, agentId: string, reported?: unknown): object =>
  makeBundleArtifactAdapter().plan(agentOf(control, agentId), control.desired(agentId), reported)

/**
 * The node plan. The node record is `desiredNode(...).node`, so there is no
 * second lookup that could disagree with the deployment being planned.
 */
export const nodePlan = (control: AgentdControl, nodeId: string, reported?: unknown): object => {
  const desired = control.desiredNode(nodeId)
  return makeNodeArtifactAdapter().plan(desired.node, desired, reported)
}
