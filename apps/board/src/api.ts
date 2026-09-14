import { toEffectTools, type EffectTool, type Operation } from "@effect-agent/effect-interface"
import type { BoardApi } from "./board.ts"
import { docOperations } from "./docs/ops.ts"
import { runOperations } from "./runs/ops.ts"
import { taskOperations } from "./tasks/ops.ts"

export const boardOperations = (board: BoardApi): readonly Operation[] => [
  ...taskOperations(board),
  ...runOperations(board),
  ...docOperations(board),
]

export const makeBoardTools = (board: BoardApi): readonly EffectTool[] => toEffectTools(boardOperations(board))
