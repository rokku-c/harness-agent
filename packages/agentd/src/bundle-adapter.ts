/**
 * The agent-level artifact adapter: what one machine is told to run for one
 * agent (§7.6).
 *
 * The adapter itself invents nothing. It resolves a desired config into
 * artifacts, refuses an artifact the machine cannot run *before* anything is
 * written down, and hands back the plan the executor applies — the adjudication
 * it leans on lives in `bundles.ts`, and the shape it emits in `bundle-artifact.ts`.
 */

import { artifactOf, validateBundleConfig, type BundleAgentConfig } from "./bundle-artifact.ts"
import { assessBundleForMachine, bundleRefId } from "./bundles.ts"
import { fail } from "./guards.ts"
import { machineCapability } from "./machine-capability.ts"
import { same } from "./stable.ts"
import type { AdapterPlan, AgentAdapter, AgentInstance, DesiredAgentConfig } from "./types.ts"

const changesOf = (next: BundleAgentConfig, previous?: BundleAgentConfig): readonly string[] => {
  if (previous === undefined) {
    return next.artifacts.map((artifact) => `install ${bundleRefId(artifact)} (${artifact.kind})`)
  }
  const before = new Map(previous.artifacts.map((artifact) => [bundleRefId(artifact), artifact]))
  const changes: string[] = []
  for (const artifact of next.artifacts) {
    const id = bundleRefId(artifact)
    const old = before.get(id)
    before.delete(id)
    if (old === undefined) changes.push(`install ${id} (${artifact.kind})`)
    else if (!same(old, artifact)) changes.push(`update ${id} (${artifact.kind})`)
  }
  for (const id of before.keys()) changes.push(`remove ${id}`)
  return changes
}

/**
 * The artifact adapter. Same contract as {@link makeGatewayConfigAdapter}: plan
 * may refuse, apply never invents anything, and a rollback (`desired.revision`
 * below what the machine reported) is a 409 — the receipt is the concurrency
 * control, identical to every other agentd adapter.
 */
export const makeBundleArtifactAdapter = (): AgentAdapter<BundleAgentConfig> => ({
  kind: "effect-bundle",
  validate: validateBundleConfig,
  plan(agent: AgentInstance, desired: DesiredAgentConfig, reported?: unknown): AdapterPlan<BundleAgentConfig> {
    if (desired.agent.agentId !== agent.agentId) fail("agent identity mismatch")
    if (!Number.isInteger(desired.revision) || desired.revision < 0) fail("invalid desired revision")
    const machine = desired.machine
    if (machine === undefined) fail("desired config names no machine; runtime and abi cannot be adjudicated")
    if (machine.machineId !== agent.machineId) fail("machine identity mismatch")

    const capability = machineCapability(machine)
    // Refuse *before* anything is written down: an artifact this machine cannot
    // run must not appear in a plan the executor would then try to apply.
    for (const bundle of desired.bundles ?? []) {
      const verdict = assessBundleForMachine(bundle, capability)
      if (!verdict.ok) fail(`cannot push ${bundleRefId(bundle)} to ${machine.machineId}: ${verdict.reason.message}`)
    }

    let previous: BundleAgentConfig | undefined
    if (reported !== undefined) {
      validateBundleConfig(reported)
      if (reported.metadata.agentId !== agent.agentId) fail("reported agent identity mismatch")
      if (desired.revision < reported.metadata.revision) fail("stale agent revision")
      previous = reported
    }

    const config: BundleAgentConfig = {
      artifacts: (desired.bundles ?? []).map(artifactOf),
      metadata: { agentId: agent.agentId, revision: desired.revision },
    }
    validateBundleConfig(config)
    return { agentId: agent.agentId, revision: desired.revision, desired: config, changes: changesOf(config, previous) }
  },
  async apply(plan: AdapterPlan<BundleAgentConfig>): Promise<BundleAgentConfig> {
    validateBundleConfig(plan.desired)
    if (plan.agentId !== plan.desired.metadata.agentId || plan.revision !== plan.desired.metadata.revision) fail("invalid adapter plan")
    return plan.desired
  },
})
