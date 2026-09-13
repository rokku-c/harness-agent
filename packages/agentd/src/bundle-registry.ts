/**
 * The published-artifact registry (§7.6, P6): which bundle versions an agentd
 * knows, and where each one's bytes are.
 *
 * Split out of `control.ts` because it is the one part of the control plane with
 * a *second* surface — the bytes a node fetches — and the two must agree: a
 * version is fetchable exactly when it is published, and a publish that is
 * refused must leave nothing behind, neither a registry entry nor a recorded
 * directory.
 *
 * Version identity is owned here, and that is why the one-version-one-content
 * rule is a refusal to publish a repeat at all (`bundles.has`) rather than a
 * comparison of bytes: a second publish under a live id would be a second writer
 * to the same version, and every node that already took the first one is holding
 * the other.
 */

import type { BundleRef } from "./types.ts"
import { AgentdError } from "./errors.ts"
import { bundleRefId } from "./bundles.ts"
import { makeArtifactStore } from "./artifacts.ts"
import { toWire, type WireArtifact } from "./artifact-wire.ts"

export interface BundleRegistry {
  /** Publish one version; `source` is the directory its bytes live in, when it has one. */
  publish(bundle: BundleRef, source?: string): BundleRef
  get(id: string): BundleRef | undefined
  list(): readonly BundleRef[]
  /** One version's bytes, ready for the wire. A version with no directory is a 404. */
  artifact(id: string): WireArtifact
  /** Which versions have bytes, for `status()` — a published version may have none. */
  artifactIds(): readonly string[]
}

export const makeBundleRegistry = (): BundleRegistry => {
  /** Keyed `bundleId@version`, so two versions of one artifact coexist (§6.1's repo already does). */
  const bundles = new Map<string, BundleRef>()
  const artifacts = makeArtifactStore()
  return {
    publish(bundle, source) {
      if (!bundle.bundleId || /\s/.test(bundle.bundleId)) throw new AgentdError(400, "invalid bundle id")
      if (!bundle.version || /\s/.test(bundle.version)) throw new AgentdError(400, "invalid bundle version")
      // The `bootstrap-N` line belongs to the host↔kernel side only (§5). A kernel
      // with no host line is unpublishable (nothing downstream could adjudicate
      // it), and an app carrying one would be conflating the two lines.
      if ((bundle.kind ?? "app") === "kernel") {
        if (bundle.bootstrapAbi === undefined) throw new AgentdError(400, "kernel bundle must declare bootstrapAbi")
      } else if (bundle.bootstrapAbi !== undefined) {
        throw new AgentdError(400, "app bundle must not declare bootstrapAbi; that line is host↔kernel")
      }
      const id = bundleRefId(bundle)
      if (bundles.has(id)) throw new AgentdError(409, "bundle already published")
      // Bytes last, so a refusal above cannot leave a directory recorded under a
      // version no agent can be bound to.
      if (source !== undefined) artifacts.publish(id, source)
      bundles.set(id, bundle)
      return bundle
    },
    get: (id) => bundles.get(id),
    list: () => [...bundles.values()],
    artifact: (id) => toWire(artifacts, id),
    artifactIds: () => artifacts.ids(),
  }
}
