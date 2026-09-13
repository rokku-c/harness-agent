/**
 * The artifact shape a machine is actually told to run, and the validator that
 * refuses anything else.
 *
 * "Fully resolved" is the point: kind and runtimes are filled in here, so the
 * receiving host applies no defaults of its own and cannot disagree with what
 * `bundles.ts` adjudicated. The validator is the same one both adapters use —
 * an agent-level push and a node-level placement are checked by one reader, so a
 * stricter rule applies to both rather than to whichever was edited.
 */

import { bundleRuntimes, type EffectRuntimeKind } from "@effect-agent/effect-bundle"
import { bundleKind, bundleRefId } from "./bundles.ts"
import { fail, nonEmpty, record, sameKeys } from "./guards.ts"
import { isRuntime } from "./machine-capability.ts"
import type { BundleRef } from "./types.ts"

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

export function validateBundleConfig(config: unknown): asserts config is BundleAgentConfig {
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
