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
import { boardHeader } from "./effect-ui-header.ts"
import { stateFilter, worktable, worktableUrl } from "./effect-ui-table.ts"
import { createFields, selectedFields } from "./effect-ui-forms.ts"

/** One shape of the tasks, on screen only while it is the chosen one. */
const shape = (name: string, children: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "4" },
  visible: { source: { state: "/view" }, equals: name },
  children: [...children],
})

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
    // A press names the task and goes there. What fills the screen is the
    // screen's own business (`onEnter` below), so a row and a pasted link are
    // the same act and there is one read, not one per door.
    { name: "board.open", opens: "task" },
    { name: "board.create", method: "POST", url: "/board/api/tasks", result: "/createResult",
      clear: ["/create/title", "/create/body"], refresh: ["table"] },
    // Entering the task screen is what reads the task. The id comes from the
    // address, which is where a press put it — so the press and the link differ
    // in nothing, and a read that fails says so on the screen that asked.
    { name: "board.load", method: "GET", url: "/board/api/tasks/{taskId}", result: "/selected",
      params: { taskId: { state: "/_nav/taskId" } } },
    { name: "board.save", method: "PATCH", url: "/board/api/tasks/{taskId}", result: "/selectedResult", refresh: ["table"] },
    { name: "board.delete", method: "DELETE", url: "/board/api/tasks/{taskId}", result: "/selectedResult", refresh: ["table"] },
  ],
  nodes: [
    boardHeader,
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
    { id: "task", title: "Opened task", onEnter: "board.load", nodes: selectedFields },
    { id: "new", title: "New task", nodes: createFields },
  ],
}
