import { z } from "@effect-agent/effect-config"

export const states = ["todo", "doing", "blocked", "done", "cancelled"] as const
/** epoch milliseconds; a task with neither field is unscheduled and off-calendar */
const moment = z.number().int().nonnegative()
/**
 * The patchable core, deliberately WITHOUT defaults: a default would make an
 * omitted field parse as its default, so a patch that touches one field would
 * silently erase every field it did not mention. Creation adds the defaults on
 * top of this instead.
 */
const coreFields = {
  title: z.string().trim().min(1).max(300), body: z.string(), state: z.enum(states),
  dependsOn: z.array(z.string().min(1)), startAt: moment, dueAt: moment,
}
export const createTaskSchema = z.object({
  ...coreFields,
  body: z.string().default(""), state: z.enum(states).default("todo"),
  dependsOn: z.array(z.string().min(1)).default([]),
  parentId: z.string().min(1).optional(), startAt: moment.optional(), dueAt: moment.optional(),
}).strict()
/** A patch accepts null to clear a field; an omitted field keeps its value. */
export const updateTaskSchema = z.object({
  ...coreFields,
  parentId: z.string().min(1).nullable().optional(),
  startAt: moment.nullable().optional(), dueAt: moment.nullable().optional(),
}).partial().strict()
export const taskSchema = createTaskSchema.extend({ id: z.string(), createdAt: z.number(), updatedAt: z.number() }).strict()
export type Task = z.infer<typeof taskSchema>
export type TaskInput = z.input<typeof createTaskSchema>
export type TaskPatch = z.input<typeof updateTaskSchema>
export class BoardError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "BoardError" }
}
export const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const out = schema.safeParse(value)
  if (!out.success) throw new BoardError(400, out.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "))
  return out.data
}
