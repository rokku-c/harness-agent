/**
 * a2ui/sanitize.ts - ONE COMPONENT AGAINST ITS OFFICIAL SCHEMA.
 *
 * Concept: strip props the schema does not declare, then parse; on failure
 * apply the targeted repairs (a copy per attempt so each starts from the
 * same stripped props); if it still does not validate, DEGRADE it (rehost
 * as Column or a visible Text placeholder). Unknown components (not in the
 * basic catalog) pass through untouched - genuine model errors must surface
 * at render time.
 */
import { catalogSchemaByName, type CatalogIssue } from "./catalog.ts"
import { applyIssueRepair, stripProps } from "./repairs.ts"
import { degradeToText, rehostAsColumn } from "./degrade.ts"

const RENAMED_KEYS: Record<string, string> = { src: "url" } // agent says src, official says url

export const sanitizeComponent = (comp: Record<string, unknown>): Record<string, unknown> => {
  const schema = catalogSchemaByName.get(String(comp.component))
  if (schema === undefined) return comp
  const { id, component, ...props } = comp as { id?: unknown; component: string; [k: string]: unknown }
  const allowed = new Set(Object.keys(schema.shape))
  const candidate = stripProps(props, allowed, RENAMED_KEYS)

  // targeted repairs on a copy so each attempt starts from the same stripped props
  for (let attempt = 0; attempt < 3; attempt++) {
    const outcome = schema.safeParse(candidate)
    if (outcome.success && outcome.data !== undefined)
      return { id, component, ...(outcome.data as Record<string, unknown>) }
    const issues = (outcome.error as { issues?: CatalogIssue[] }).issues ?? []
    let changed = false
    for (const issue of issues) {
      if (applyIssueRepair(candidate, comp, issue)) changed = true
    }
    if (!changed) break
  }

  // still invalid: degrade, keeping content visible where possible
  const asColumn = rehostAsColumn(id, comp)
  if (asColumn !== undefined) return asColumn
  return degradeToText(id, comp, schema, candidate)
}
