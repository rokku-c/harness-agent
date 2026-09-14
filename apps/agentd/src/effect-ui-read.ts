import { press, row, sourceStatusPath, type SourceState, type UiNodeSpec } from "@effect-agent/effect-ui"

const when = (id: string, state: SourceState): UiNodeSpec["visible"] =>
  ({ source: { state: `${sourceStatusPath(id)}/state` }, equals: state })

export const sourceFailed = (id: string): UiNodeSpec["visible"] => when(id, "failed")
export const readFailed = (reason: string): UiNodeSpec["visible"] => ({ source: { state: reason } })

export const readPending = (path: string): UiNodeSpec["visible"] =>
  ({ any: [{ source: { state: `${path}/ok` }, not: true }, { source: { state: `${path}/error` }, not: true }] })

export const pending = (guard: UiNodeSpec["visible"], rows = 4): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "3" },
  visible: guard,
  children: Array.from({ length: rows }, (): UiNodeSpec =>
    ({ component: "Skeleton", props: { height: "1.5rem", width: "40%" } })),
})

const skeletonRow = (columns: number): UiNodeSpec => ({
  component: "Table.Row",
  children: Array.from({ length: columns }, (): UiNodeSpec =>
    ({ component: "Table.Cell", children: [{ component: "Skeleton" }] })),
})

export const reading = (id: string, columns: number, rows = 6): UiNodeSpec => ({
  component: "Table.Root",
  props: { variant: "surface", size: "1" },
  visible: when(id, "loading"),
  children: [
    { component: "Table.Header", children: [{ component: "Table.Row", children:
      Array.from({ length: columns }, (): UiNodeSpec =>
        ({ component: "Table.ColumnHeaderCell", children: [{ component: "Skeleton", props: { height: "1rem" } }] })) }] },
    { component: "Table.Body", children: Array.from({ length: rows }, () => skeletonRow(columns)) },
  ],
})

export const readFailure = (guard: UiNodeSpec["visible"], sentence: string, reason: string, action: string): UiNodeSpec => ({
  component: "Callout.Root",
  props: { color: "red", size: "1", highContrast: true },
  visible: guard,
  children: [
    { component: "Callout.Text", children: [
      { component: "Text", props: { value: sentence, size: "2" } },
      { component: "Code", props: { size: "2" }, bind: reason },
    ] },
    row([{ ...press("Try again", action, undefined, { variant: "soft", size: "1" }), visible: guard }]),
  ],
})
