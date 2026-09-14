import { region, type EffectUiView, type UiNodeSpec } from "@effect-agent/effect-ui"
import { boardActions } from "./effect-ui-actions.ts"
import { boardColumns } from "./effect-ui-columns.ts"
import { createScreen } from "./effect-ui-create.ts"
import { documentScreen } from "./effect-ui-documents.ts"
import { eventScreen } from "./effect-ui-events.ts"
import { boardFilter } from "./effect-ui-filter.ts"
import { boardHeader } from "./effect-ui-header.ts"
import { answered, boardEmptiness, emptyBoard, readFailure } from "./effect-ui-notices.ts"
import { outlineScreen } from "./effect-ui-outline.ts"
import { reading } from "./effect-ui-skeleton.ts"
import { boardSources, boardState } from "./effect-ui-state.ts"
import { taskScreen } from "./effect-ui-task.ts"
import { worktable } from "./effect-ui-worktable.ts"

const shape = (name: string, children: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "5" },
  visible: { source: { state: "/view" }, equals: name },
  children: [...children],
})

export const effectUiView: EffectUiView = {
  viewId: "board-console",
  title: "Board",
  state: boardState,
  sources: boardSources,
  actions: boardActions,
  nodes: [
    boardHeader,
    region([
      ...readFailure,
      reading,
      { component: "Flex", props: { direction: "column", gap: "5" }, visible: answered, children: [
        shape("table", [boardFilter, ...boardEmptiness, worktable]),
        shape("board", [emptyBoard, boardColumns]),
      ] },
    ]),
  ],
  screens: [
    { id: "task", title: "Task", onEnter: "board.load", nodes: taskScreen },
    { id: "new", title: "New task", nodes: createScreen },
    { id: "documents", title: "Documents", nodes: documentScreen },
    { id: "outline", title: "Outline", onEnter: "board.loadDocument", nodes: outlineScreen },
    { id: "events", title: "Events", nodes: eventScreen },
  ],
}
