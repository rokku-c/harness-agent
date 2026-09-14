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
