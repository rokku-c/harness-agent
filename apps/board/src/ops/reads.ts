/** ops/read-ops.ts - the coordinator's READ SURFACE.
 *  Concept: the coordinator inspects the live board as declared column views
 *  or by single item id - read-only, so a breakdown matches reality before
 *  any subtask is created. The view output is coerced to a plain shape the
 *  agent can reason about. */
import { Op, notationText } from "@effect-agent/core"
import { Effect } from "effect"
import { Schema } from "effect"
import type { BoardApi } from "../board.ts"
import { OptionalString, ReadOut, ViewOut } from "./schemas.ts"

/** board_view + board_item Ops over a live board */
export const readOps = (board: BoardApi): ReadonlyArray<unknown> => {
  const board_view = Op.read({
    name: "board_view",
    description: notationText(
      "Read the board as columns. input.view names a view (default the first); " +
      "each column lists the item ids in it, grouped by work-item state. " +
      "Inspect before creating subtasks so the breakdown matches reality."
    ),
    input: Schema.Struct({ view: OptionalString }),
    output: ViewOut,
    execute: ({ view }) =>
      board.viewItems(view === undefined ? undefined : view).pipe(
        Effect.map((result) => result as { view: { name: string; columns: Array<Record<string, unknown>> } }),
        Effect.map((r) => ({
          view: {
            name: r.view.name,
            columns: r.view.columns.map((c) => ({
              id: String(c.id),
              title: String(c.title),
              states: (c.states as Array<string>) ?? [],
              itemIds: (c.itemIds as Array<string>) ?? []
            }))
          }
        }))
      )
  })
  const board_item = Op.read({
    name: "board_item",
    description: notationText("Read one work item by id (state, priority, dependencies, children, body)."),
    input: Schema.Struct({ itemId: Schema.String }),
    output: ReadOut,
    execute: ({ itemId }) =>
      board.getItem(itemId).pipe(
        Effect.map((item) => {
          if (item === undefined) return { item: undefined }
          return {
            item: {
              itemId: item.itemId,
              title: item.title,
              state: item.state,
              priority: item.priority,
              body: item.body,
              assigneeId: item.assigneeId,
              blockedReason: item.blockedReason,
              dependencies: [...item.dependencies],
              children: [...item.children]
            }
          }
        })
      )
  })
  return [board_view, board_item]
}
