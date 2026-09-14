/**
 * The board's first paint: the worktable's shape, before it has the worktable's
 * content.
 *
 * A loading region is never a spinner, and it is never bars of a shape the answer
 * will not have: it is the worktable's own columns, at the worktable's own row
 * height, so what lands fills the frame the reader is already looking at instead
 * of replacing it. Six rows is the count a first paint is specified with; the
 * board itself is unbounded, and a skeleton that pretended otherwise would be a
 * placeholder making a promise it cannot keep.
 *
 * `aria-busy` rides on the skeleton itself rather than on the region: the region
 * is the same node after the answer lands and a prop cannot be conditional, while
 * the skeleton exists exactly while the read is in flight. That is what keeps the
 * attribute and the state it reports from drifting apart.
 */

import { sourceStatusPath, type UiNodeSpec } from "@effect-agent/effect-ui"

const loading: UiNodeSpec["visible"] =
  ({ source: { state: `${sourceStatusPath("table")}/state` }, equals: "loading" })

/** The worktable's four columns, at the widths their content runs to. */
const widths = ["55%", "35%", "40%", "25%"]
const skeletonCell = (width: string): UiNodeSpec =>
  ({ component: "Table.Cell", props: { py: "2", px: "2" },
    children: [{ component: "Skeleton", props: { height: "1rem", width } }] })
const skeletonRow = (): UiNodeSpec => ({ component: "Table.Row", children: widths.map(skeletonCell) })

export const reading: UiNodeSpec = {
  component: "Table.Root",
  props: { variant: "surface", size: "1", "aria-busy": "true" },
  visible: loading,
  children: [
    { component: "Table.Header", children: [skeletonRow()] },
    { component: "Table.Body", children: Array.from({ length: 6 }, skeletonRow) },
  ],
}
