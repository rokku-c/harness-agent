import { WORKSPACE_RESOURCES, type WorkKind } from "../workspace.ts"
import type { Tier } from "../supply.ts"
import { FRAMEWORK } from "./framework.ts"
import type { CapabilityDecl } from "./types.ts"

type Resource = { kind: WorkKind; write: { name: string; tier: Tier; description: string } }

export const resourceAppendCapabilities = (resources: ReadonlyArray<Resource>): readonly CapabilityDecl[] =>
  resources.map((resource) => ({
    name: resource.write.name,
    tier: resource.write.tier,
    description: resource.write.description,
    impl: "resource.append",
    kind: resource.kind
  }))

export const assembleCapabilities = (resources: ReadonlyArray<Resource>): readonly CapabilityDecl[] => [
  ...FRAMEWORK,
  ...resourceAppendCapabilities(resources)
]

export const MANTIS_CAPABILITIES: readonly CapabilityDecl[] = assembleCapabilities(WORKSPACE_RESOURCES)
