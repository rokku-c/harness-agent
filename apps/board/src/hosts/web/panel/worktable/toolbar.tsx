/** worktable/toolbar.tsx - the FILTER TOOLBAR.
 *  Concept: group chips (server-declared column titles, always a count),
 *  assignee chips and a free-text filter. Pure view state - the container
 *  owns group/q/assignee and this only renders + reports changes. */
import type { ColInfo } from "../api.ts"
import { When } from "../board/helpers.tsx"

export function Toolbar({ cols, counts, itemsCount, group, setGroup, assignees, assignee, setAssignee, q, setQ }: {
  cols: ColInfo[]
  counts: Map<string, number>
  itemsCount: number
  group: string
  setGroup: (g: string) => void
  assignees: string[]
  assignee: string
  setAssignee: (a: string) => void
  q: string
  setQ: (v: string) => void
}) {
  return (
    <div className="wt-tool">
      <button className={"wt-chip" + (group === "" ? " on" : "")} onClick={() => setGroup("")}>All {itemsCount}</button>
      {cols.map((c) => (
        <button key={c.id} className={"wt-chip" + (group === c.title ? " on" : "")} onClick={() => setGroup(group === c.title ? "" : c.title)}>
          {c.title} <span className="wt-count">{counts.get(c.title) ?? 0}</span>
        </button>
      ))}
      <When c={assignees.length > 0}>
        <span className="wt-vr" />
        <button className={"wt-chip" + (assignee === "" ? " on" : "")} onClick={() => setAssignee("")}>anyone</button>
        {assignees.map((a) => (
          <button key={a} className={"wt-chip wt-chip-id" + (assignee === a ? " on" : "")} onClick={() => setAssignee(assignee === a ? "" : a)}>@{a}</button>
        ))}
      </When>
      <input className="wt-search" value={q} placeholder="filter items…" aria-label="filter items"
        onChange={(e) => setQ(e.currentTarget.value)} />
    </div>
  )
}
