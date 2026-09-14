import type { UiNodeSpec } from "./spec.ts"

export type SourceState = "loading" | "ready" | "empty" | "failed"

export interface SourceStatus {
  readonly state: SourceState
  readonly answered: boolean
  readonly error: string | null
  readonly count: number
  readonly at: number
}

export const sourceStatusPath = (id: string): string => `/_sources/${id}`

export const initialStatus = (): SourceStatus =>
  ({ state: "loading", answered: false, error: null, count: 0, at: 0 })

export const sourceStateOf = (answered: boolean, error: string | null, count: number): SourceState =>
  error !== null ? "failed" : !answered ? "loading" : count === 0 ? "empty" : "ready"

export const readStatus = (value: unknown): SourceStatus => {
  const record = (value ?? {}) as Partial<SourceStatus>
  return { ...initialStatus(), ...record }
}

const when = (id: string, state: SourceState): UiNodeSpec["visible"] =>
  ({ source: { state: `${sourceStatusPath(id)}/state` }, equals: state })

export const loadingRows = (id: string, rows = 3): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "2" },
  visible: when(id, "loading"),
  children: Array.from({ length: rows }, () => ({ component: "Skeleton", props: { height: "1.75rem" } })),
})

export const emptyNotice = (id: string, message: string): UiNodeSpec => ({
  component: "Text",
  props: { value: message, color: "gray", size: "2" },
  visible: when(id, "empty"),
})

export const failureNotice = (id: string): UiNodeSpec => ({
  component: "Callout.Root",
  props: { color: "red", highContrast: true, size: "1" },
  visible: when(id, "failed"),
  children: [{ component: "Callout.Text", bind: `${sourceStatusPath(id)}/error` }],
})

export const sourceStates = (id: string, empty: string, rows = 3): readonly UiNodeSpec[] =>
  [loadingRows(id, rows), emptyNotice(id, empty), failureNotice(id)]
