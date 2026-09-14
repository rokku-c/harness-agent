import { AgentdError, makeBundleArtifactAdapter, makeNodeArtifactAdapter, type AgentdControl } from "@effect-agent/agentd"

type AgentRecord = ReturnType<AgentdControl["desired"]>["agent"]

export const agentOf = (control: AgentdControl, agentId: string): AgentRecord => {
  const status = control.status() as { readonly agents?: readonly AgentRecord[] }
  const agent = (status.agents ?? []).find((candidate) => candidate.agentId === agentId)
  if (agent === undefined) throw new AgentdError(404, "agent not found")
  return agent
}

export const bundlePlan = (control: AgentdControl, agentId: string, reported?: unknown): object =>
  makeBundleArtifactAdapter().plan(agentOf(control, agentId), control.desired(agentId), reported)

export const nodePlan = (control: AgentdControl, nodeId: string, reported?: unknown): object => {
  const desired = control.desiredNode(nodeId)
  return makeNodeArtifactAdapter().plan(desired.node, desired, reported)
}
