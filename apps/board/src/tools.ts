import { z, toJsonSchema } from "@effect-agent/effect-config"
import type { EffectTool } from "@effect-agent/effect-interface"
import type { BoardApi } from "./board.ts"
import { createTaskSchema, updateTaskSchema, type TaskInput, type TaskPatch } from "./tasks/schema.ts"

export const makeBoardTools = (board: BoardApi): readonly EffectTool[] => {
  const tool = (name: string, description: string, input: z.ZodType, handler: (args: unknown) => unknown): EffectTool =>
    ({ name, description, input, inputSchema: toJsonSchema(input), handler })
  const id = z.object({ id: z.string() }).strict(), empty = z.object({}).strict()
  return [
    tool("board_state", "Read task board state and counts", empty, () => board.state()),
    tool("board_get", "Read one task", id, (a) => board.get((a as { id: string }).id)),
    tool("board_create", "Create a task", createTaskSchema, (a) => board.create(a as TaskInput)),
    tool("board_update", "Update a task's data (not an agent launch)", z.object({ id: z.string(), patch: updateTaskSchema }).strict(),
      (a) => { const { id, patch } = a as { id: string; patch: TaskPatch }; return board.update(id, patch) }),
    tool("board_delete", "Delete an unreferenced task", id, (a) => board.delete((a as { id: string }).id)),
    tool("board_tree", "Read the task hierarchy", empty, () => board.tree()),
    tool("board_events", "Read ordered task events after a sequence", z.object({ after: z.number().int().min(0).optional() }).strict(),
      (a) => ({ events: board.events((a as { after?: number }).after) })),
  ]
}
