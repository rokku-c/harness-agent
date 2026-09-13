/**
 * The board's console view.
 *
 * One source, because all three shapes below are the same tasks: the worktable
 * reads them as rows, the columns view as a wall, and a second fetch of the same
 * list is a second copy to drift from the first. A source owns the path it
 * writes, so the filter, the open record and the drafts all live outside
 * `/table`.
 *
 * Three screens, one per thing an operator is doing: reading the board, writing
 * a new task, and working on one that is already open. The board is `nodes`, and
 * the other two are entered from it — a row's `Open`, which reads the record and
 * then shows it, and the header's `New task`, which only shows the form. The
 * worktable and the columns are the same screen's two shapes and are never both
 * on screen, so nothing is drawn twice.
 */
import { emptyRows, failureNotice, loadingRows, region } from "@effect-agent/effect-ui"
import type { EffectUiView, UiNodeSpec } from "@effect-agent/effect-ui"
import { boardColumns } from "./effect-ui-board.ts"
import { stateFilter, worktable, worktableUrl } from "./effect-ui-table.ts"
import { createFields, selectedFields } from "./effect-ui-forms.ts"

const heading = (value: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Heading", props: { value, ...props } })

/** One shape of the tasks, on screen only while it is the chosen one. */
const shape = (name: string, children: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "4" },
  visible: { source: { state: "/view" }, equals: name },
  children: [...children],
})

const item = (value: string, label: string): UiNodeSpec =>
  ({ component: "SegmentedControl.Item", props: { value }, children: [{ component: "Text", props: { value: label } }] })

const viewSwitch: UiNodeSpec = {
  component: "SegmentedControl.Root",
  props: { size: "2" },
  bind: "/view",
  children: [item("table", "Worktable"), item("board", "Columns")],
}

/** The two doors out of the board, and the reason they are here rather than in the list below. */
const controls: UiNodeSpec = {
  component: "Flex",
  props: { align: "center", gap: "3", wrap: "wrap" },
  children: [viewSwitch, { component: "Button", props: { value: "New task", variant: "solid" }, onPress: "board.new" }],
}

export const effectUiView: EffectUiView = {
  viewId: "board-console",
  title: "Board",
  state: {
    table: { columns: [], rows: [] },
    filter: "all",
    view: "table",
    selected: {},
    create: { title: "", body: "", state: "todo" },
    createResult: {},
    selectedResult: {},
  },
  sources: [{ id: "table", url: worktableUrl, state: "/table", refreshMs: 10000 }],
  actions: [
    // nothing to read first: the screen is a form, and the form is already there
    { name: "board.new", opens: "new" },
    { name: "board.create", method: "POST", url: "/board/api/tasks", result: "/createResult",
      clear: ["/create/title", "/create/body"], refresh: ["table"] },
    // one press, two effects: the record lands in `/selected`, and the screen
    // that renders it comes up. That is what opening a row is.
    { name: "board.open", method: "GET", url: "/board/api/tasks/{taskId}", result: "/selected", opens: "task" },
    { name: "board.save", method: "PATCH", url: "/board/api/tasks/{taskId}", result: "/selectedResult", refresh: ["table"] },
    { name: "board.delete", method: "DELETE", url: "/board/api/tasks/{taskId}", result: "/selectedResult", refresh: ["table"] },
  ],
  nodes: [
    { component: "Flex", props: { justify: "between", align: "baseline", gap: "4", wrap: "wrap" }, children: [
      { component: "Flex", props: { direction: "column", gap: "1" }, children: [
        heading("Board", { size: "6" }),
        { component: "Text", props: { value: "Hierarchical work items, who holds each one, and what is blocking them.", color: "gray" } },
      ] },
      controls,
    ] },
    // Everything below the header is as long as the board is, and the board has
    // no limit: the table and the columns scroll in their own box, and the
    // header — which holds both doors — stays where it was. The notices belong
    // to the table rather than to the page, so they travel with it.
    region([
      loadingRows("table", 3),
      failureNotice("table"),
      emptyRows("table", "/table/rows", "No work items yet."),
      shape("table", [stateFilter, worktable]),
      shape("board", [boardColumns]),
    ]),
  ],
  screens: [
    { id: "task", title: "Opened task", nodes: selectedFields },
    { id: "new", title: "New task", nodes: createFields },
  ],
}
