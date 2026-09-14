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
