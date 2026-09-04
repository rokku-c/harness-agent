/** worktable/derive.ts - PURE TABLE DERIVATION.
 *  Concept: column membership is decided server-side (col.itemIds); the
 *  table must agree with the Kanban view column-for-column, so nothing here
 *  re-derives membership from item state - only id->column lookups, filter
 *  sets and the row sort order. */
import type { ColInfo, WorkItem } from "../api.ts"
import type { ResourceRow } from "./table-types.ts"

export interface Derived {
  readonly resNames: Map<string, string>
  readonly itemTitle: (id: string) => string
  readonly colForId: Map<string, number>
  readonly titles: string[]
  readonly counts: Map<string, number>
  readonly assignees: string[]
  readonly stateTitle: (state: string) => string
}

export const derive = (cols: ColInfo[], items: WorkItem[], resources: ResourceRow[]): Derived => {
  const resNames = new Map(resources.map((r) => [r.resourceId, r.name]))
  const itemTitleMap = new Map(items.map((i) => [i.itemId, i.title]))
  const colForId = new Map<string, number>()
  cols.forEach((c, idx) => c.itemIds.forEach((id) => colForId.set(id, idx)))
  const titles = cols.map((c) => c.title)
  const counts = new Map<string, number>()
  for (const c of cols) counts.set(c.title, c.itemIds.length)
  const assignees = [...new Set(items.map((i) => i.assigneeId).filter((a): a is string => a !== undefined))].sort()
  const stateMap = new Map<string, string>()
  for (const c of cols) for (const s of c.states) if (!stateMap.has(s)) stateMap.set(s, c.title)
  return {
    resNames,
    itemTitle: (id) => itemTitleMap.get(id) ?? id,
    colForId,
    titles,
    counts,
    assignees,
    stateTitle: (state) => stateMap.get(state) ?? state
  }
}

export const colIdx = (d: Derived, itemId: string): number => {
  const ci = d.colForId.get(itemId)
  return ci === undefined ? 99 : ci
}
export const colTitle = (d: Derived, itemId: string): string => {
  const ci = d.colForId.get(itemId)
  return ci !== undefined && d.titles[ci] ? d.titles[ci] : ""
}

export const prioIdx = (p?: string): number =>
  ({ urgent: 0, high: 1, normal: 2, low: 3 })[p ?? "normal"] ?? 2

/** apply group/assignee/search filters + the row sort, all pure */
export const filterRows = (items: WorkItem[], d: Derived, group: string, q: string, assignee: string): WorkItem[] => {
  const needle = q.trim().toLowerCase()
  return items
    .filter((it) => group === "" || colTitle(d, it.itemId) === group)
    .filter((it) => assignee === "" || it.assigneeId === assignee)
    .filter((it) => needle === "" || (it.title + " " + (it.body ?? "") + " " + it.itemId).toLowerCase().includes(needle))
    .sort((a, b) => colIdx(d, a.itemId) - colIdx(d, b.itemId) || prioIdx(a.priority) - prioIdx(b.priority) || b.updatedAt - a.updatedAt)
}
