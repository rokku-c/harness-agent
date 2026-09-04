/** ops/create-op.ts - the coordinator's ONE WRITE.
 *  Concept: the coordinator only ever creates children under a parent
 *  (writes parentId); it never starts, reports, cancels or claims - that is
 *  the executors' job, which keeps coordination itself free of the
 *  governor. Requires lists board resources the item needs while doing. */
import { Op, notationText } from "@effect-agent/core"
import { Effect } from "effect"
import type { BoardApi } from "../board.ts"
import { CreateIn, CreateOut } from "./schemas.ts"

export const createOp = (board: BoardApi): unknown => {
  const board_create_item = Op.write({
    name: "board_create_item",
    description: notationText(
      "Create a work item (state todo) and return its id. Set parentId when " +
      "this item is part of a breakdown under a parent goal; the parent's " +
      "children list is updated automatically. Set dependencies to other " +
      "item ids that must finish first. Requires lists board resources the " +
      "item needs while doing."
    ),
    input: CreateIn,
    output: CreateOut,
    execute: (input) =>
      board.createItem({
        title: input.title,
        body: input.body,
        parentId: input.parentId,
        priority: input.priority as "low" | "normal" | "high" | "urgent" | undefined,
        dependencies: input.dependencies,
        labels: input.labels,
        requires: input.requires
      }).pipe(Effect.map((r) => ({ ok: true, itemId: r.itemId, detail: undefined })))
  })
  return board_create_item
}
