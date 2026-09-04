import { Effect } from "effect"
import type { Model } from "@effect-agent/builtin"
import { makeBoard, type BoardApi } from "../src/board.ts"
import { makeBoardMcp } from "../src/hosts/mcp/board-mcp.ts"

export type Script = Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }>

/** deterministic model: replays a script of turns, then replies "done" */
export const scriptedModel = (script: Script): Model => {
  const queue = [...script]
  const model: any = {
    generate: (_s: string, _m: unknown, _t: unknown) => {
      const step = queue.shift() ?? { text: "done" }
      return Effect.succeed({ text: step.text, toolCalls: step.toolCalls ?? [] })
    }
  }
  return model as Model
}

export const freshBoard = (): Promise<BoardApi> => Effect.runPromise(makeBoard({ dataFile: undefined }))

export { makeBoardMcp }
