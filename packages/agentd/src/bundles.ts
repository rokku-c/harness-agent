/**
 * Artifact distribution — agentd pushes *code*, not just configuration (§7.6).
 *
 * `adapter.ts` pushes the MCP surface an agent should have. This file pushes the
 * bundle artifacts a machine should run: the kernel and the apps. Same shape,
 * same receipt (`AgentBinding.revision` + `reportApplied`'s 409), same adapter
 * contract — the only new question is "can this machine run this artifact?".
 *
 * That question is *not* answered here. It is answered by the one adjudication
 * the platform already has (`@effect-agent/effect-bundle`'s `assessBundleCompat`
 * / `assessKernelCompat`, §5). Writing a second comparison in agentd would be
 * exactly the "另立 semver 规则" §5 forbids — and would drift from the gate the
 * host actually enforces at load time, which is the only opinion that matters.
 *
 * A machine states what it can run in `Machine.capabilities`:
 *
 *   abi:effect-1 · bootstrap:bootstrap-1 · runtime:os
 *
 * Absent facts fall back to the SDK's own defaults (compat.ts), so an existing
 * machine that declares nothing is adjudicated as an OS host on the current
 * lines — conservative, and identical to what the host would decide.
 */

import {
  assessBundleCompat,
  assessKernelCompat,
  bundleRuntimes,
  EFFECT_RUNTIME_KINDS,
  kernelRevision,
  type CompatVerdict,
  type EffectRuntimeKind,
  type Incompatibility,
  type KernelRevision,
} from "@effect-agent/effect-bundle"
import { AgentdError } from "./errors.ts"
import { fail, nonEmpty, record, sameKeys } from "./guards.ts"
import { same } from "./stable.ts"
import type { AdapterPlan, AgentAdapter, AgentInstance, BundleRef, DesiredAgentConfig, Machine } from "./types.ts"

export interface MachineCapability {
  readonly abi?: string
  readonly bootstrapAbi?: string
  readonly runtime?: EffectRuntimeKind
}

const isRuntime = (value: string): value is EffectRuntimeKind =>
  (EFFECT_RUNTIME_KINDS as readonly string[]).includes(value)

/**
 * Read a machine's declared capabilities.
 *
 * An unrecognized `runtime:` value is an error rather than a silent fallback: a
 * typo'd `runtime:brower` would otherwise push OS artifacts to a browser host
 * and be discovered at load time on that machine, which is the failure mode
 * "fail loud, never silently downgrade" (§5) exists to prevent.
 */
export const machineCapability = (machine: Pick<Machine, "capabilities">): MachineCapability => {
  const out: { abi?: string; bootstrapAbi?: string; runtime?: EffectRuntimeKind } = {}
  for (const raw of machine.capabilities) {
    const at = raw.indexOf(":")
    if (at <= 0) continue
    const key = raw.slice(0, at), value = raw.slice(at + 1)
    if (key === "abi") out.abi = value
    else if (key === "bootstrap") out.bootstrapAbi = value
    else if (key === "runtime") {
      if (!isRuntime(value)) {
        throw new AgentdError(400, `machine declares an unknown runtime "${value}"; expected one of ${EFFECT_RUNTIME_KINDS.join(" | ")}`)
      }
      out.runtime = value
    }
  }
  return out
}

/** `board@1.0.0` — one artifact version, which is what a binding names. */
export const bundleRefId = (bundle: Pick<BundleRef, "bundleId" | "version">): string =>
  `${bundle.bundleId}@${bundle.version}`

const bundleKind = (bundle: BundleRef): "app" | "kernel" => bundle.kind ?? "app"

/**
 * Can this machine run this artifact? The verdict is the SDK's, not agentd's —
 * the only work done here is routing an app to the bundle gate and a kernel to
 * the bootstrap gate, which is precisely the split §5 draws.
 */
export const assessBundleForMachine = (bundle: BundleRef, capability: MachineCapability): CompatVerdict => {
  if (bundleKind(bundle) === "kernel") {
    // A kernel that names no host line cannot be adjudicated, and guessing one
    // would be adjudicating a declaration nobody made.
    if (bundle.bootstrapAbi === undefined) {
      return {
        ok: false,
        reason: {
          code: "abi-unparseable",
          line: "bootstrap",
          required: "(none declared)",
          provided: capability.bootstrapAbi ?? "(host default)",
          message: `kernel "${bundle.bundleId}" declares no bootstrapAbi; a kernel must name the host line it needs`,
        } satisfies Incompatibility,
      }
    }
    return assessKernelCompat(
      { kernelId: bundle.bundleId, abi: bundle.abi, bootstrapAbi: bundle.bootstrapAbi, runtimes: bundle.runtimes },
      { bootstrapAbi: capability.bootstrapAbi, runtime: capability.runtime },
    )
  }
  return assessBundleCompat(
    { bundleId: bundle.bundleId, abi: bundle.abi, runtimes: bundle.runtimes },
    { abi: capability.abi, runtime: capability.runtime },
  )
}

/**
 * A pushed kernel artifact, as the host's artifact repo will record it (§6.1) —
 * so what agentd pushes is what `supervisor.stage()` / `EffectServer.stageKernel()`
 * accept, with no translation layer in between that could disagree with the gate.
 *
 * `revision` is the *receiving host's* own monotonic counter, not the binding
 * revision: two machines have two repos, and the receipt's number is not the
 * repo's number. Keeping them separate is why this is a caller-supplied argument
 * rather than something read off `BundleRef`.
 */
export const kernelRevisionOf = (bundle: BundleRef, revision: number, dir?: string): KernelRevision => {
  if (bundleKind(bundle) !== "kernel" || bundle.bootstrapAbi === undefined) {
    throw new AgentdError(400, `bundle ${bundleRefId(bundle)} is not a kernel artifact; only a kernel can be staged`)
  }
  return kernelRevision(
    { kernelId: bundle.bundleId, abi: bundle.abi, bootstrapAbi: bundle.bootstrapAbi, runtimes: bundle.runtimes },
    revision,
    dir,
  )
}

/** One artifact as the machine is told to run it. Fully resolved, no defaults left. */
export interface BundleArtifact {
  readonly bundleId: string
  readonly version: string
  readonly kind: "app" | "kernel"
  readonly abi: string
  readonly runtimes: readonly EffectRuntimeKind[]
  readonly bootstrapAbi?: string
}

export interface BundleAgentConfig {
  readonly artifacts: readonly BundleArtifact[]
  /** The receipt this config is measured against — same field name as the gateway adapter. */
  readonly metadata: { readonly agentId: string; readonly revision: number }
}

const ARTIFACT_KEYS = ["bundleId", "version", "kind", "abi", "runtimes"]

export const validateBundleArtifact = (value: unknown): BundleArtifact => {
  const artifact: Record<string, unknown> = record(value) ? value : fail("invalid bundle artifact")
  if (!nonEmpty(artifact.bundleId) || !nonEmpty(artifact.version) || !nonEmpty(artifact.abi)) fail("invalid bundle artifact")
  if (artifact.kind !== "app" && artifact.kind !== "kernel") fail("invalid bundle artifact kind")
  // The bootstrap line exists only on the host↔kernel side (§5). Requiring it on
  // a kernel *and* forbidding it on an app is what keeps the two lines from being
  // conflated — a permissive check would let `bootstrap-N` ride along on an app,
  // which is the confusion §5 names. Checked before the key-set comparison so
  // the message names the line rather than the whole object being malformed.
  if (artifact.kind === "kernel" && !nonEmpty(artifact.bootstrapAbi)) fail("kernel artifact must declare bootstrapAbi")
  if (artifact.kind === "app" && artifact.bootstrapAbi !== undefined) fail("app artifact must not declare bootstrapAbi; that line is host↔kernel")
  const keys = artifact.kind === "kernel" ? [...ARTIFACT_KEYS, "bootstrapAbi"] : ARTIFACT_KEYS
  if (!sameKeys(artifact, keys)) fail("invalid bundle artifact")
  if (!Array.isArray(artifact.runtimes) || artifact.runtimes.length === 0 || !artifact.runtimes.every((kind) => typeof kind === "string" && isRuntime(kind))) {
    fail("invalid bundle artifact runtimes")
  }
  return artifact as unknown as BundleArtifact
}

function validateBundleConfig(config: unknown): asserts config is BundleAgentConfig {
  const value: Record<string, unknown> = record(config) ? config : fail("invalid bundle config")
  if (!sameKeys(value, ["artifacts", "metadata"])) fail("invalid bundle config")
  if (!Array.isArray(value.artifacts)) fail("invalid bundle config")
  value.artifacts.forEach(validateBundleArtifact)
  const ids = (value.artifacts as readonly BundleArtifact[]).map(bundleRefId)
  if (new Set(ids).size !== ids.length) fail("bundle config names the same artifact twice")
  const metadata: Record<string, unknown> = record(value.metadata) ? value.metadata : fail("invalid bundle metadata")
  if (!sameKeys(metadata, ["agentId", "revision"])) fail("invalid bundle metadata")
  if (!nonEmpty(metadata.agentId)) fail("invalid bundle metadata")
  if (typeof metadata.revision !== "number" || !Number.isInteger(metadata.revision) || metadata.revision < 0) fail("invalid bundle metadata")
}

/**
 * A {@link BundleRef} as a resolved artifact: kind and runtimes filled in, so
 * nothing downstream has to re-apply a default. Shared with the node adapter
 * (§8.4), which places these at addresses rather than inventing its own shape.
 */
export const artifactOf = (bundle: BundleRef): BundleArtifact => ({
  bundleId: bundle.bundleId,
  version: bundle.version,
  kind: bundleKind(bundle),
  abi: bundle.abi,
  runtimes: bundleRuntimes(bundle),
  ...(bundle.bootstrapAbi === undefined ? {} : { bootstrapAbi: bundle.bootstrapAbi }),
})

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
