/** ops/coordinator.ts - ASSEMBLE the builtin coordinator's tool surface.
 *  Concept: makeBoardCoordinatorOps puts readOps + createOp together; the
 *  binding claims the coordinator's ea://svc/board/coordinator uri so the
 *  agent runtime can route these declared ops to it. */
import type { Binding } from "@effect-agent/core"
import { eaUri } from "@effect-agent/core"
import type { BoardApi } from "../board.ts"
import { readOps } from "./reads.ts"
import { createOp } from "./create-op.ts"

/** the builtin coordinator's tool surface over a live board */
export const makeBoardCoordinatorOps = (board: BoardApi): ReadonlyArray<unknown> => [
  ...readOps(board),
  createOp(board)
]

/** binding the builtin coordinator writes to (uri ea://svc/board/coordinator) */
export const boardCoordinatorBinding = (board: BoardApi): Binding => ({
  uri: eaUri("svc", "board", "coordinator"),
  ops: makeBoardCoordinatorOps(board) as never
})
