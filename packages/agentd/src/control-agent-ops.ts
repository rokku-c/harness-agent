import { parsePrincipalKey } from "@effect-agent/effect-authz"
import type { ControlState } from "./control-state.ts"
import type { AgentdControl } from "./contract.ts"
import { AgentdError } from "./errors.ts"
import { bindingFor, desired as agentConfig } from "./control-projections.ts"

const principalId = (id: string): string => {
  if (parsePrincipalKey(id) === undefined) {
    throw new AgentdError(400, `"${id}" is not a principal key; an agent is named kind:id, e.g. app:${id}`)
  }
  return id
}

export const agentOps = (control: ControlState): Pick<AgentdControl,
  "registerMachine" | "registerAgent" | "registerServer" | "upsertSet" | "bindAgent" | "setCredential"
  | "mcpsets" | "publishBundle" | "artifact" | "bindBundles" | "desired" | "reportApplied"> => ({
  registerMachine(machine) { control.checkId(machine.machineId); control.machines.set(machine.machineId, machine); control.bump(); return machine },
  registerAgent(agent) {
    control.checkId(agent.agentId)
    const agentId = principalId(agent.agentId)
    if (!control.machines.has(agent.machineId)) throw new AgentdError(404, "machine not found")
    control.agents.set(agentId, agent); control.bump(); return agent
  },
  registerServer(server) { control.checkId(server.serverId); if (control.servers.has(server.serverId)) throw new AgentdError(409, "server already exists"); control.servers.set(server.serverId, server); control.bump(); return server },
  upsertSet(set) { control.checkId(set.setId); if (set.servers.some((id) => !control.servers.has(id))) throw new AgentdError(404, "server not found"); control.sets.set(set.setId, set); control.bump(); return set },
  bindAgent(agentId, setIds) { if (!control.agents.has(agentId)) throw new AgentdError(404, "agent not found"); if (setIds.some((id) => !control.sets.has(id))) throw new AgentdError(404, "set not found"); const binding = { ...bindingFor(control, agentId), setIds, revision: control.bump() }; control.bindings.set(agentId, binding); return binding },
  setCredential(agentId, token) {
    if (!control.agents.has(agentId)) throw new AgentdError(404, "agent not found")
    if (typeof token !== "string" || token.length === 0) throw new AgentdError(400, "an empty credential names nobody")
    control.credentials.set(agentId, token); control.bump(); return { agentId, revision: control.revision() }
  },
  mcpsets: () => ({ revision: control.revision(), sets: [...control.sets.values()], bindings: [...control.bindings.values()] }),
  publishBundle(bundle, source) { const published = control.registry.publish(bundle, source); control.bump(); return published },
  artifact(id, token) {
    if (!control.guard.authorized(token)) throw new AgentdError(401, "unauthorized artifact fetch")
    return control.registry.artifact(id)
  },
  bindBundles(agentId, bundleIds) {
    if (bundleIds.some((id) => control.registry.get(id) === undefined)) throw new AgentdError(404, "bundle not found")
    const binding = { ...bindingFor(control, agentId), bundleIds, revision: control.bump() }
    control.bindings.set(agentId, binding); return binding
  },
  desired: (agentId) => agentConfig(control, agentId),
  reportApplied(agentId, appliedRevision, state) { const current = agentConfig(control, agentId); if (appliedRevision !== current.revision) throw new AgentdError(409, "stale agent revision"); return { agentId, revision: appliedRevision, state } },
})
