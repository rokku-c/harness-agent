import { sourceStatusPath, type UiNodeSpec } from "@effect-agent/effect-ui"

const loading: UiNodeSpec["visible"] =
  ({ source: { state: `${sourceStatusPath("table")}/state` }, equals: "loading" })

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
