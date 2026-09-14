import { AgentdError } from "./errors.ts"
import type { ControlState } from "./control-state.ts"
import type { DesiredNode } from "./node-types.ts"
import type { AgentBinding, DesiredAgentConfig } from "./types.ts"

export const bindingFor = (control: ControlState, agentId: string): AgentBinding => {
  if (!control.agents.has(agentId)) throw new AgentdError(404, "agent not found")
  const existing = control.bindings.get(agentId)
  return existing ?? { agentId, setIds: [], bundleIds: [], revision: 0 }
}

export const desired = (control: ControlState, agentId: string): DesiredAgentConfig => {
  const agent = control.agents.get(agentId); if (!agent) throw new AgentdError(404, "agent not found")
  const machine = control.machines.get(agent.machineId)
  const binding = control.bindings.get(agentId)
  const credential = control.credentials.get(agentId)
  const held = credential === undefined ? {} : { credential }
  if (!binding) return { agent, revision: control.revision(), sets: [], servers: [], bundles: [], ...held, ...(machine === undefined ? {} : { machine }) }
  const selected = binding.setIds.map((id) => control.sets.get(id)!).filter(Boolean)
  const serverIds = [...new Set(selected.flatMap((set) => set.servers))]
  return {
    agent, machine: machine!, revision: binding.revision, sets: selected,
    servers: serverIds.map((id) => control.servers.get(id)!).filter(Boolean),
    bundles: binding.bundleIds.map((id) => control.registry.get(id)!).filter(Boolean),
    ...held,
  }
}

export const desiredNode = (control: ControlState, nodeId: string): DesiredNode => {
  const node = control.machines.get(nodeId)
  if (node === undefined) throw new AgentdError(404, "node not found")
  const held = control.nodes.get(nodeId)
  if (held === undefined) return { node, revision: control.revision(), kernel: undefined, apps: [] }
  return { node, revision: held.binding.revision, kernel: held.kernel, apps: held.apps }
}
