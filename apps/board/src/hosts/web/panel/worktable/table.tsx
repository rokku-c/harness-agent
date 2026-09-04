/** worktable/table.tsx - the WORKTABLE (dispatch console) container.
 *  Product thinking: a multi-agent workboard is a dispatch console, not a
 *  sticky-note wall; the panel has no drag-drop (every mutation goes through
 *  the board api act() tools). Dense rows (who/what state/what it waits
 *  on/which resources/staleness) + optional column filter; Kanban stays
 *  available as an alternative mental-mode view. View state lives here;
 *  derive.ts / toolbar.tsx / row.tsx split the pure + presentational parts. */
import { useMemo, useState } from "react"
import type { ColInfo, WorkItem } from "../api.ts"
import { When } from "../board/helpers.tsx"
import { derive, filterRows } from "./derive.ts"
import { Toolbar } from "./toolbar.tsx"
import { WorkRow } from "./row.tsx"
import type { ResourceRow } from "./table-types.ts"

export function Worktable({ cols, items, resources, onOpen, onRefresh }: {
  cols: ColInfo[]
  items: WorkItem[]
  resources: ResourceRow[]
  onOpen: (id: string) => void
  onRefresh: () => Promise<void>
}) {
  const [group, setGroup] = useState("")
  const [q, setQ] = useState("")
  const [assignee, setAssignee] = useState("")
  const d = useMemo(() => derive(cols, items, resources), [cols, items, resources])
  const rows = useMemo(() => filterRows(items, d, group, q, assignee), [items, d, group, q, assignee])
  return (
    <div className="wt">
      <Toolbar cols={cols} counts={d.counts} itemsCount={items.length} group={group} setGroup={setGroup}
        assignees={d.assignees} assignee={assignee} setAssignee={setAssignee} q={q} setQ={setQ} />
      <div className="wt-head wt-row">
        <div className="wt-c">Work item</div>
        <div className="wt-c">State</div>
        <div className="wt-c">Assignee</div>
        <div className="wt-c">Waits</div>
        <div className="wt-c">Holds</div>
        <div className="wt-c">Age</div>
        <div className="wt-c" />
      </div>
      <div className="wt-body">
        <When c={rows.length === 0}>
          <div className="wt-empty">nothing matches — adjust the filters</div>
        </When>
        {rows.map((it) => (
          <WorkRow key={it.itemId} item={it} resNames={d.resNames} itemTitle={d.itemTitle} stateTitle={d.stateTitle}
            onOpen={onOpen} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  )
}
