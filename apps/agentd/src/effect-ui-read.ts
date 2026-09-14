/**
 * What a list shows while its read is running, and what any failed read says.
 *
 * The framework's `loadingRows` draws bars of one width, which answers
 * "something is coming" and not "a table is coming": the placeholder has a
 * different shape from the answer, so the page moves when the rows land. The
 * design system asks for the answer's own shape instead, so this draws the
 * header the table will have and six rows at the same column count. The count is
 * the caller's, because the caller is the only thing that knows it.
 *
 * A read is failed in one of two ways and they are the same sentence either way.
 * A *source* failed: the runtime keeps that verdict at `/_sources/<id>`, which is
 * why the guard names an id. An *action* failed: the answer is at the path the
 * press declared, which is why that guard names a path. Both get the design
 * system's three things: what could not be read, the reason the server sent, in
 * mono, and the retry. Both retries run the declared read again rather than a
 * second copy of it, because a read is a name: the press that fetched a thing is
 * the press that fetches it again.
 */
import { press, row, sourceStatusPath, type SourceState, type UiNodeSpec } from "@effect-agent/effect-ui"

/** The one comparison every node about a source's read state makes. */
const when = (id: string, state: SourceState): UiNodeSpec["visible"] =>
  ({ source: { state: `${sourceStatusPath(id)}/state` }, equals: state })

/** The guard for a source that failed. */
export const sourceFailed = (id: string): UiNodeSpec["visible"] => when(id, "failed")
/** The guard for a read that failed: the press's own answer carries the reason. */
export const readFailed = (reason: string): UiNodeSpec["visible"] => ({ source: { state: reason } })

/**
 * The guard for a read that has neither answered nor failed: a room's first
 * paint. Both halves are needed, because a read that failed has not answered
 * either, and a placeholder drawn over a failure would hide the reason behind a
 * bar that never resolves.
 */
export const readPending = (path: string): UiNodeSpec["visible"] =>
  ({ any: [{ source: { state: `${path}/ok` }, not: true }, { source: { state: `${path}/error` }, not: true }] })

/** The placeholder for a read that fills a region rather than a table. */
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

/** The placeholder, shaped like the table it stands in for. */
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

/**
 * What could not be read, why, and the way to try it again.
 *
 * Rows from an earlier read stay where they are: this sits above the table,
 * never in place of it, so the last thing that was known is still readable under
 * the sentence saying it is no longer being refreshed. A retry that had emptied
 * the region would take the operator's evidence away at the moment they need it.
 */
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
