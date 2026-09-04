/**
 * Barrel: the groups capability split by CONCEPT (see ./groups/).
 * backend.ts = the service layer; ops.ts = the agent-facing op surface.
 * Importers keep using this path - nothing else changes.
 */
export { GroupsLayer } from "./groups/backend.ts"
export { groupOps } from "./groups/ops.ts"
