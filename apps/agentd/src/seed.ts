import type { AgentdControl } from "@effect-agent/agentd"
import type { effectConfig } from "./effect-config.ts"

/**
 * The config file's contents, written into the control plane in dependency
 * order: an artifact is published before it is placed, and a placement is bound
 * only after the artifact it names exists.
 *
 * Bundles may carry a `source` directory (§8.2, P6) — the compiled artifact's
 * bytes, so a node that has never seen this build can fetch it rather than being
 * told to run something it does not have.
 */
export const seed = (control: AgentdControl, config: ReturnType<typeof effectConfig.schema.parse>): void => {
  for (const machine of config.machines) control.registerMachine(machine)
  for (const server of config.servers) control.registerServer(server)
  for (const set of config.sets) control.upsertSet(set)
  for (const agent of config.agents) control.registerAgent(agent)
  for (const binding of config.bindings) control.bindAgent(binding.agentId, binding.setIds)
  for (const bundle of config.bundles) {
    const { source, ...artifact } = bundle
    control.publishBundle(artifact, source)
  }
  for (const binding of config.bundleBindings) control.bindBundles(binding.agentId, binding.bundleIds)
  // Node deployments last: a placement may only name an artifact that was
  // published above, and binding before publishing would be a seeding bug
  // rather than a meaningful refusal.
  for (const binding of config.nodeBindings) control.bindNode(binding.nodeId, binding.kernelId, binding.apps)
}
