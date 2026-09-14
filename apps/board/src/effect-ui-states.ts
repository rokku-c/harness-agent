/**
 * The five states a task can be in, as one list.
 *
 * The filter chips, the row's own badge, the state picker and the columns wall
 * each lay a state out for a reader, and all four read this list rather than
 * restating it. A second copy is how a picker comes to offer a state no column
 * has, and how a label drifts from the value the server stores: the values are
 * the server's own enum (`tasks/schema.ts`) and only the labels are ours.
 */

export interface StateOption {
  readonly value: string
  readonly label: string
}

export const stateOptions: readonly StateOption[] = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "Doing" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
]
