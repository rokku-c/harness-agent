/** domain/views.ts - gitlab-workitem style PROJECTIONS.
 *  Concept: a view is a named set of columns; each column shows the states
 *  (optionally narrowed by a label) that belong to it. Column membership is
 *  decided server-side so the table and kanban always agree. */
import type { WorkItemState } from "./work.ts"

export interface ViewColumn {
  readonly id: string
  readonly title: string
  /** which states appear in this column */
  readonly states: ReadonlyArray<WorkItemState>
  /** optional label filter narrowing the column further */
  readonly label?: string
}

export interface BoardView {
  readonly name: string
  readonly columns: ReadonlyArray<ViewColumn>
}
