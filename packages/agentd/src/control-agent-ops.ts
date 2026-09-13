/**
 * The agent-level verbs (§7.6, §8.2): registration, the MCP surface an agent is
 * given, and the code it is told to run.
 *
 * Grouped by what they are *about* rather than by what they touch. Every write
 * here ends in `control.bump()`, because one revision is the receipt for all of
 * them, and the reads they lean on live in `control-projections.ts`.
 */

import { parsePrincipalKey } from "@effect-agent/effect-authz"
import type { ControlState } from "./control-state.ts"
import type { AgentdControl } from "./contract.ts"
import { AgentdError } from "./errors.ts"
import { bindingFor, desired as agentConfig } from "./control-projections.ts"

/**
 * An agent's id is the key the door names it by: it resolves a credential to a
 * principal key and looks the binding up by *that*, so an agent named anything
 * else is a set of bindings nothing can ever reach. The grammar is `effect-authz`'s
 * rather than a copy here — the same reason the mcpset grammar is one file.
 */
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
  // Every way a set arrives is checked against the mcpset grammar first — the
  // config loader and the `agentd_upsert_mcpset` op — so the one rule about
  // sets (allow and deny cannot overlap) is stated there, not restated here.
  upsertSet(set) { control.checkId(set.setId); if (set.servers.some((id) => !control.servers.has(id))) throw new AgentdError(404, "server not found"); control.sets.set(set.setId, set); control.bump(); return set },
  bindAgent(agentId, setIds) { if (!control.agents.has(agentId)) throw new AgentdError(404, "agent not found"); if (setIds.some((id) => !control.sets.has(id))) throw new AgentdError(404, "set not found"); const binding = { ...bindingFor(control, agentId), setIds, revision: control.bump() }; control.bindings.set(agentId, binding); return binding },
  /**
   * The credential this agent presents at the door. It is a write like any
   * other — the config an agent should be running carries it, so it moves the
   * revision the receipt is measured against. Whose credential it is cannot be
   * checked here: only the door can verify a token, and what it verifies is a
   * principal key. The center's half is that the key it binds by and the key the
   * agent is named by are one string (`principalId`).
   */
  setCredential(agentId, token) {
    if (!control.agents.has(agentId)) throw new AgentdError(404, "agent not found")
    if (typeof token !== "string" || token.length === 0) throw new AgentdError(400, "an empty credential names nobody")
    control.credentials.set(agentId, token); control.bump(); return { agentId, revision: control.revision() }
  },
  /**
   * Not a write, so not a revision: this is what the state already says. A
   * caller reads it to *decide* with, which is why it hands back the bindings
   * as they are held rather than a projection of them.
   */
  mcpsets: () => ({ revision: control.revision(), sets: [...control.sets.values()], bindings: [...control.bindings.values()] }),
  publishBundle(bundle, source) { const published = control.registry.publish(bundle, source); control.bump(); return published },
  /**
   * A published version's bytes (§8.2, P6). Reads are not revisions: what a
   * node fetches does not change what it should run, so this does not bump.
   */
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
