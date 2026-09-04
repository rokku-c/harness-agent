/**
 * capabilities/resource.ts - GENERATED RESOURCE CAPABILITIES.
 *
 * Concept: one append capability per declared workspace resource (created
 * from workspace.ts declarations), so adding a resource grows the session
 * surface automatically. Framework + generated = the whole manifest.
 */
import { WORKSPACE_RESOURCES, type WorkKind } from "../workspace.ts"
import type { Tier } from "../supply.ts"
import { FRAMEWORK } from "./framework.ts"
import type { CapabilityDecl } from "./types.ts"

type Resource = { kind: WorkKind; write: { name: string; tier: Tier; description: string } }

/** one append capability per declared resource (generated, single source) */
export const resourceAppendCapabilities = (resources: ReadonlyArray<Resource>): readonly CapabilityDecl[] =>
  resources.map((resource) => ({
    name: resource.write.name,
    tier: resource.write.tier,
    description: resource.write.description,
    impl: "resource.append",
    kind: resource.kind
  }))

/** assemble the whole manifest: framework + generated resource capabilities */
export const assembleCapabilities = (resources: ReadonlyArray<Resource>): readonly CapabilityDecl[] => [
  ...FRAMEWORK,
  ...resourceAppendCapabilities(resources)
]

export const MANTIS_CAPABILITIES: readonly CapabilityDecl[] = assembleCapabilities(WORKSPACE_RESOURCES)
