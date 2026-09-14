/**
 * The board's console view: one read, two shapes of it, three screens.
 *
 * One source, because the worktable and the columns wall are the same tasks seen
 * twice: a second fetch of the same list is a second copy to drift from the
 * first, and a filter that hides a row in one shape would not hide it in the
 * other. A source owns the path it writes, so the filter, the two drafts and the
 * two answers all live outside `/table`.
 *
 * Three screens, one per thing an operator is doing: reading the board, writing a
 * new task, and working on a task that is already open. The board is `nodes`; the
 * other two are entered — a row's `Open`, which names the task in the address,
 * and the header's `New task`, which does not need to. Neither press reads
 * anything: a destination that has to be complete on arrival reads for itself
 * (`onEnter` on the screen), so a press and a pasted link take the same path and
 * one record is read once.
 *
 * The shapes are switched by one condition each, drawn only once the source has
 * answered — until then the region is the skeleton and nothing else, rather than
 * a layout half-built over the place its rows will land.
 */

import { region, NAV_ROOT, type EffectUiView, type UiNodeSpec } from "@effect-agent/effect-ui"
import { boardColumns } from "./effect-ui-columns.ts"
import { stateFilter } from "./effect-ui-filter.ts"
import { boardHeader } from "./effect-ui-header.ts"
import { answered, boardEmptiness, emptyBoard, readFailure } from "./effect-ui-notices.ts"
import { reading } from "./effect-ui-skeleton.ts"
import { worktable, worktableUrl } from "./effect-ui-worktable.ts"
import { createScreen } from "./effect-ui-create.ts"
import { taskScreen } from "./effect-ui-task.ts"

/** One shape of the board, drawn only while it is the chosen one. */
const shape = (name: string, children: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "5" },
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
    create: { title: "", body: "", state: "todo" },
    createResult: {},
    selected: {},
    selectedResult: {},
  },
  // The board is read on a timer because it is written by something other than
  // this screen: an agent holds a task over MCP while a human watches the list.
  sources: [{ id: "table", url: worktableUrl, state: "/table", refreshMs: 10000 }],
  actions: [
    // Nothing to read first: a screen that is only a form is already complete.
    { name: "board.new", opens: "new" },
    // The id travels in the address and the screen reads it from there, so this
    // press carries nothing the destination does not already ask for.
    { name: "board.open", opens: "task" },
    { name: "board.create", method: "POST", url: "/board/api/tasks", result: "/createResult",
      clear: ["/create/title", "/create/body"], refresh: ["table"] },
    // Entering the task screen is what reads the task. The id is read from the
    // address rather than supplied by a press, which is what makes a pasted link
    // and a press the same act.
    { name: "board.load", method: "GET", url: "/board/api/tasks/{taskId}", result: "/selected",
      params: { taskId: { state: `${NAV_ROOT}/taskId` } } },
    { name: "board.save", method: "PATCH", url: "/board/api/tasks/{taskId}", result: "/selectedResult",
      refresh: ["table"] },
    { name: "board.delete", method: "DELETE", url: "/board/api/tasks/{taskId}", result: "/selectedResult",
      refresh: ["table"] },
    // No `url`: the read this repeats is the source's own, so the press makes no
    // second request and the refresh is the whole of it.
    { name: "board.retry", refresh: ["table"] },
  ],
  nodes: [
    boardHeader,
    // Everything below the header is as long as the board is, and the board has
    // no limit: the shapes scroll in their own box and the header — which holds
    // both the shape switch and the way to a new task — stays where it was.
    region([
      ...readFailure,
      reading,
      { component: "Flex", props: { direction: "column", gap: "5" }, visible: answered, children: [
        shape("table", [stateFilter, ...boardEmptiness, worktable]),
        shape("board", [emptyBoard, boardColumns]),
      ] },
    ]),
  ],
  screens: [
    { id: "task", title: "Task", onEnter: "board.load", nodes: taskScreen },
    { id: "new", title: "New task", nodes: createScreen },
  ],
}
