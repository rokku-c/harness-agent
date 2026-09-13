/**
 * effect-authz — the effective view of one principal.
 *
 * view(principal) = TEMPLATE[kind] ⊕ grants(principal), default deny. This is
 * the value the gateway both projects (`tools/list`) and enforces (`tools/call`)
 * from, and the value it compiles into effect-planes grants — one table, not two.
 */

import { subjectMatches, type PolicyEntry } from "./policy.ts"
import { principalKey, type Principal } from "./principal.ts"
import { templateEntries, type TemplateTable } from "./templates.ts"

export const resolveView = (
  table: TemplateTable,
  grants: readonly PolicyEntry[],
  principal: Principal,
): readonly PolicyEntry[] => {
  const key = principalKey(principal)
  return [
    ...templateEntries(table, principal),
    ...grants.filter((entry) => subjectMatches(entry.subject, key)),
  ]
}
