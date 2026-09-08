import type { AgentBinding, AgentInstance, DesiredAgentConfig, McpServerRef, McpSet, Machine } from "./types.ts"
import type { AgentdControl } from "./contract.ts"
import { AgentdError } from "./errors.ts"

export const makeAgentdControl = (): AgentdControl => {
  const machines = new Map<string, Machine>(), agents = new Map<string, AgentInstance>()
  const servers = new Map<string, McpServerRef>(), sets = new Map<string, McpSet>(), bindings = new Map<string, AgentBinding>()
  let revision = 0
  const bump = () => ++revision
  const checkId = (id: string) => { if (!id || /\s/.test(id)) throw new AgentdError(400, "invalid id") }
  const desired = (agentId: string): DesiredAgentConfig => {
    const agent = agents.get(agentId); if (!agent) throw new AgentdError(404, "agent not found")
    const binding = bindings.get(agentId); if (!binding) return { agent, revision, sets: [], servers: [] }
    const selected = binding.setIds.map((id) => sets.get(id)!).filter(Boolean)
    const serverIds = [...new Set(selected.flatMap((set) => set.servers))]
    return { agent, revision: binding.revision, sets: selected, servers: serverIds.map((id) => servers.get(id)!).filter(Boolean) }
  }
  return {
    registerMachine(machine) { checkId(machine.machineId); machines.set(machine.machineId, machine); bump(); return machine },
    registerAgent(agent) { checkId(agent.agentId); if (!machines.has(agent.machineId)) throw new AgentdError(404, "machine not found"); agents.set(agent.agentId, agent); bump(); return agent },
    registerServer(server) { checkId(server.serverId); if (servers.has(server.serverId)) throw new AgentdError(409, "server already exists"); servers.set(server.serverId, server); bump(); return server },
    upsertSet(set) { checkId(set.setId); if (set.allowTools?.some((tool) => set.denyTools?.includes(tool))) throw new AgentdError(400, "allow/deny overlap"); if (set.servers.some((id) => !servers.has(id))) throw new AgentdError(404, "server not found"); sets.set(set.setId, set); bump(); return set },
    bindAgent(agentId, setIds) { if (!agents.has(agentId)) throw new AgentdError(404, "agent not found"); if (setIds.some((id) => !sets.has(id))) throw new AgentdError(404, "set not found"); const binding = { agentId, setIds, revision: bump() }; bindings.set(agentId, binding); return binding },
    desired, reportApplied(agentId, appliedRevision, state) { const current = desired(agentId); if (appliedRevision !== current.revision) throw new AgentdError(409, "stale agent revision"); return { agentId, revision: appliedRevision, state } },
    status: () => ({ machines: [...machines.values()], agents: [...agents.values()], servers: [...servers.values()], sets: [...sets.values()], bindings: [...bindings.values()], revision }),
  }
}
