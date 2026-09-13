/**
 * The task surface: the board's own data, declared once for every transport.
 *
 * Each operation is one tool *and* one route, validated by the same schema, so
 * an agent calling `board_create` and a client POSTing to `/api/tasks` cannot
 * disagree about what a task is.
 */
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
    // the subscription endpoint an ICS client (Apple Calendar) refetches on its
    // own timer; it is a projection, so it stores nothing of its own
    name: "board_calendar", description: "The tasks with a due time, as an RFC 5545 calendar feed", access: "read",
    input: noInput, http: { method: "GET", path: "/api/calendar.ics", contentType: "text/calendar; charset=utf-8" },
    handler: () => toIcs(board.list(), { name: "Board", description: "Board tasks with a start or due time" }),
  }),
  operation({
    // `after` replays history from a sequence; `tail` asks for the newest events
    // instead, which is the reading a live view needs — replaying from zero
    // returns the *oldest* page and never the current activity
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
    // over HTTP the patch IS the body: the id is in the path, and wrapping it in
    // an envelope would make the route a different API from the tool
    http: { method: "PATCH", path: "/api/tasks/:id", bodyField: "patch" },
    handler: (input) => board.update(input.id, input.patch),
  }),
  operation({ name: "board_delete", description: "Delete an unreferenced task", input: id,
    http: { method: "DELETE", path: "/api/tasks/:id" }, handler: (input) => board.delete(input.id) }),
]
