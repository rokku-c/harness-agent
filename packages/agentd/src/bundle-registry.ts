import type { BundleRef } from "./types.ts"
import { AgentdError } from "./errors.ts"
import { bundleRefId } from "./bundles.ts"
import { makeArtifactStore } from "./artifacts.ts"
import { toWire, type WireArtifact } from "./artifact-wire.ts"

export interface BundleRegistry {
  publish(bundle: BundleRef, source?: string): BundleRef
  get(id: string): BundleRef | undefined
  list(): readonly BundleRef[]
  artifact(id: string): WireArtifact
  artifactIds(): readonly string[]
}

export const makeBundleRegistry = (): BundleRegistry => {
  const bundles = new Map<string, BundleRef>()
  const artifacts = makeArtifactStore()
  return {
    publish(bundle, source) {
      if (!bundle.bundleId || /\s/.test(bundle.bundleId)) throw new AgentdError(400, "invalid bundle id")
      if (!bundle.version || /\s/.test(bundle.version)) throw new AgentdError(400, "invalid bundle version")
      if ((bundle.kind ?? "app") === "kernel") {
        if (bundle.bootstrapAbi === undefined) throw new AgentdError(400, "kernel bundle must declare bootstrapAbi")
      } else if (bundle.bootstrapAbi !== undefined) {
        throw new AgentdError(400, "app bundle must not declare bootstrapAbi; that line is host↔kernel")
      }
      const id = bundleRefId(bundle)
      if (bundles.has(id)) throw new AgentdError(409, "bundle already published")
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
