/**
 * a2ui/degrade.ts - DEGRADATION when a component cannot be repaired.
 *
 * Concept: one bad component must never blank the whole surface. Container
 * content is re-hosted as a Column (content survives); otherwise the node
 * becomes a Text placeholder naming the component AND the concrete zod
 * issues, so the reason is visible on screen - closing the loop without
 * guessing - while keeping any text the component carried.
 */
import { catalogSchemaByName, type CatalogSchema } from "./catalog.ts"
import { CONTAINERS } from "./catalog.ts"

/** pick a short human/agent-readable excerpt for degraded content */
export const contentExcerpt = (comp: Record<string, unknown>): string | undefined => {
  for (const key of ["text", "label", "value"]) {
    if (typeof comp[key] === "string" && (comp[key] as string).length > 0)
      return String(comp[key]).slice(0, 80)
  }
  return undefined
}

/** re-host a container's children under a Column when the container is unusable */
export const rehostAsColumn = (
  id: unknown,
  comp: Record<string, unknown>
): Record<string, unknown> | undefined => {
  const childrenIds = Array.isArray(comp.children)
    ? (comp.children as unknown[]).filter((item): item is string => typeof item === "string")
    : []
  if (childrenIds.length === 0 || !CONTAINERS.has(String(comp.component))) return undefined
  const columnSchema = catalogSchemaByName.get("Column")
  if (columnSchema === undefined) return undefined
  const asColumn = columnSchema.safeParse({ children: childrenIds })
  return asColumn.success ? { id, component: "Column", children: childrenIds } : undefined
}

const reasonText = (schema: CatalogSchema, candidate: Record<string, unknown>): string => {
  const check = schema.safeParse(candidate)
  if (!check.success)
    return (check.error as { issues?: Array<{ code?: string; path?: Array<string | number>; message?: string }> }).issues
      ?.map((issue) => String(issue.path?.join(".") ?? "") + " " + String(issue.message)).slice(0, 3).join("; ")
      ?? "schema mismatch"
  return "schema mismatch"
}

/** the visible Text placeholder naming the component + the zod reason */
export const degradeToText = (
  id: unknown,
  comp: Record<string, unknown>,
  schema: CatalogSchema,
  candidate: Record<string, unknown>
): Record<string, unknown> => {
  const excerpt = contentExcerpt(comp)
  const where = String(id ?? "")
  // echo inline strings from a degraded container so intended text stays visible
  const inline = Array.isArray(comp.children)
    ? (() => {
        const strings = (comp.children as unknown[]).filter((x): x is string => typeof x === "string")
        return strings.length > 0 ? " [" + strings.slice(0, 6).join(" | ") + "]" : ""
      })()
    : ""
  return {
    id,
    component: "Text",
    text: "[unrendered " + String(comp.component) + (where ? " " + where : "") + " - " +
      (reasonText(schema, candidate)) + "]" + (excerpt !== undefined ? " " + excerpt : "") + inline
  }
}
