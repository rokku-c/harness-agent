/**
 * Barrel: the clew/mantis capability manifest split by CONCEPT
 * (see ./capabilities/). types.ts = the decl contract; framework.ts = the
 * fixed session surface; resource.ts = generated append capabilities per
 * declared workspace resource (single source: workspace.ts).
 */
export type { CapabilityImpl, CapabilityDecl } from "./capabilities/types.ts"
export {
  resourceAppendCapabilities, assembleCapabilities, MANTIS_CAPABILITIES
} from "./capabilities/resource.ts"
