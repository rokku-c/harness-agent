import type { AgentdControl } from "@effect-agent/agentd"
import type { effectConfig } from "./effect-config.ts"

export const seed = (control: AgentdControl, config: ReturnType<typeof effectConfig.schema.parse>): void => {
  for (const machine of config.machines) control.registerMachine(machine)
  for (const server of config.servers) control.registerServer(server)
  for (const set of config.sets) control.upsertSet(set)
  for (const agent of config.agents) control.registerAgent(agent)
  for (const { agentId, token } of config.credentials) control.setCredential(agentId, token)
  for (const binding of config.bindings) control.bindAgent(binding.agentId, binding.setIds)
  for (const bundle of config.bundles) {
    const { source, ...artifact } = bundle
    control.publishBundle(artifact, source)
  }
  for (const binding of config.bundleBindings) control.bindBundles(binding.agentId, binding.bundleIds)
  for (const binding of config.nodeBindings) control.bindNode(binding.nodeId, binding.kernelId, binding.apps)
}
