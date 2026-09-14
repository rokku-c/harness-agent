import { csv, count, noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { BoardApi } from "../board.ts"
import { toIcs } from "./calendar.ts"
import { createTaskSchema, updateTaskSchema } from "./schema.ts"

const id = z.object({ id: z.string().min(1) }).strict()

export const taskOperations = (board: BoardApi): readonly Operation[] => [
  operation({ name: "board_health", description: "Liveness of the board surface", access: "read", input: noInput,
    http: { method: "GET", path: "/api/health" }, handler: () => ({ ok: true }) }),
  operation({ name: "board_state", description: "Read task board state and counts", access: "read", input: noInput,
    http: { method: "GET", path: "/api/state" }, handler: () => board.state() }),
  operation({ name: "board_tree", description: "Read the task tree with each node's derived state, progress, and run status",
    access: "read", input: noInput, http: { method: "GET", path: "/api/tree" }, handler: () => board.tree() }),
  operation({
    name: "board_table", description: "Read tasks as table rows, including which agent holds each one", access: "read",
    input: z.object({ columns: csv(z.array(z.string().min(1)).optional()) }).strict(),
    http: { method: "GET", path: "/api/table" },
    handler: (input) => board.table(input.columns),
  }),
  operation({
    name: "board_calendar", description: "The tasks with a due time, as an RFC 5545 calendar feed", access: "read",
    input: noInput, http: { method: "GET", path: "/api/calendar.ics", contentType: "text/calendar; charset=utf-8" },
    handler: () => toIcs(board.list(), { name: "Board", description: "Board tasks with a start or due time" }),
  }),
  operation({
    name: "board_events", description: "Read ordered board events after a sequence, or the most recent with `tail`", access: "read",
    input: z.object({ after: count.optional(), tail: count.optional() }).strict(), http: { method: "GET", path: "/api/events" },
    handler: (input) => ({ events: input.tail === undefined ? board.events(input.after) : board.recentEvents(input.tail) }),
  }),
  operation({ name: "board_get", description: "Read one task", access: "read", input: id,
    http: { method: "GET", path: "/api/tasks/:id" }, handler: (input) => board.get(input.id) }),
  operation({ name: "board_create", description: "Create a task", input: createTaskSchema,
    http: { method: "POST", path: "/api/tasks", status: 201 }, handler: (input) => board.create(input) }),
  operation({
    name: "board_update", description: "Update a task's data (not an agent launch)", input: z.object({ id: z.string().min(1), patch: updateTaskSchema }).strict(),
    http: { method: "PATCH", path: "/api/tasks/:id", bodyField: "patch" },
    handler: (input) => board.update(input.id, input.patch),
  }),
  operation({ name: "board_delete", description: "Delete an unreferenced task", input: id,
    http: { method: "DELETE", path: "/api/tasks/:id" }, handler: (input) => board.delete(input.id) }),
]
