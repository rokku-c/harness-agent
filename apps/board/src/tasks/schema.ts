import { z } from "@effect-agent/effect-config"

export const states = ["todo", "doing", "blocked", "done", "cancelled"] as const
export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(300), body: z.string().default(""),
  state: z.enum(states).default("todo"), parentId: z.string().min(1).optional(),
  dependsOn: z.array(z.string().min(1)).default([]),
}).strict()
export const updateTaskSchema = createTaskSchema.partial().extend({ parentId: z.string().min(1).nullable().optional() }).strict()
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
