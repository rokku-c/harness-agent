/**
 * Board's whole surface, in one list.
 *
 * Every operation below is served twice - as an MCP tool and as an HTTP route -
 * from this one declaration, which is why an agent and a UI cannot drift into
 * two different boards. The HTTP host and the stdio MCP host each project the
 * list; neither adds behaviour of its own.
 */
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

/** The same operations as tools: what an agent reaches over MCP. */
export const makeBoardTools = (board: BoardApi): readonly EffectTool[] => toEffectTools(boardOperations(board))
