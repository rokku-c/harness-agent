import { bundleRuntimes, type EffectRuntimeKind } from "@effect-agent/effect-bundle"
import { bundleKind, bundleRefId } from "./bundles.ts"
import { fail, nonEmpty, record, sameKeys } from "./guards.ts"
import { isRuntime } from "./machine-capability.ts"
import type { BundleRef } from "./types.ts"

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
  readonly metadata: { readonly agentId: string; readonly revision: number }
}

const ARTIFACT_KEYS = ["bundleId", "version", "kind", "abi", "runtimes"]

export const validateBundleArtifact = (value: unknown): BundleArtifact => {
  const artifact: Record<string, unknown> = record(value) ? value : fail("invalid bundle artifact")
  if (!nonEmpty(artifact.bundleId) || !nonEmpty(artifact.version) || !nonEmpty(artifact.abi)) fail("invalid bundle artifact")
  if (artifact.kind !== "app" && artifact.kind !== "kernel") fail("invalid bundle artifact kind")
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

export const artifactOf = (bundle: BundleRef): BundleArtifact => ({
  bundleId: bundle.bundleId,
  version: bundle.version,
  kind: bundleKind(bundle),
  abi: bundle.abi,
  runtimes: bundleRuntimes(bundle),
  ...(bundle.bootstrapAbi === undefined ? {} : { bootstrapAbi: bundle.bootstrapAbi }),
})
