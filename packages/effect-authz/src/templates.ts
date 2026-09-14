import type { Action } from "./action.ts"
import { ANY_SUBJECT, type PolicyEntry } from "./policy.ts"
import { principalKey, type Principal } from "./principal.ts"
import { REST_SEGMENT, asResource } from "./resource.ts"

export const SELF = "$self"

export interface TemplateTable {
  readonly user: readonly PolicyEntry[]
  readonly app: readonly PolicyEntry[]
  readonly system: readonly PolicyEntry[]
}

const rule = (resource: string, actions: readonly Action[]): PolicyEntry => ({
  subject: ANY_SUBJECT,
  resource: asResource(resource),
  actions,
  effect: "allow",
  source: "template",
})

export const DEFAULT_TEMPLATES: TemplateTable = {
  user: [rule(SELF, ["read", "call"])],
  app: [rule(SELF, ["call"])],
  system: [rule(REST_SEGMENT, ["read", "call", "write"])],
}

const substitute = (raw: string, principal: Principal): string => raw.split(SELF).join(principal.id)

export const templateEntries = (table: TemplateTable, principal: Principal): readonly PolicyEntry[] => {
  const key = principalKey(principal)
  return table[principal.kind].map((entry) => ({
    ...entry,
    subject: entry.subject === ANY_SUBJECT ? key : entry.subject,
    resource: asResource(substitute(entry.resource.raw, principal)),
  }))
}
