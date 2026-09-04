/** worktable/table-types.ts - SHARED TABLE SHAPES.
 *  Concept: the resource row shape the table derives names from + the props
 *  WorkRow and Worktable receive - one place, so the two components cannot
 *  drift apart on the contract with the api layer. */
export interface ResourceRow {
  readonly resourceId: string
  readonly name: string
  readonly kind: string
  readonly capacity: number
  readonly used: number
}

export interface WorkRowProps {
  readonly item: import("../api.ts").WorkItem
  readonly resNames: Map<string, string>
  readonly itemTitle: (id: string) => string
  readonly stateTitle: (state: string) => string
  readonly onOpen: (id: string) => void
  readonly onRefresh: () => Promise<void>
}
