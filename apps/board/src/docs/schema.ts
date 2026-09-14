import { z } from "@effect-agent/effect-config"

export interface OutlineNode {
  readonly nodeId: string
  readonly text: string
  readonly done: boolean
  readonly children: OutlineNode[]
}

export const outlineNodeSchema: z.ZodType<OutlineNode> = z.lazy(() => z.object({
  nodeId: z.string().min(1), text: z.string().max(2000), done: z.boolean().default(false),
  children: z.array(outlineNodeSchema).default([]),
}).strict())

export const documentSchema = z.object({
  docId: z.string(), title: z.string().trim().min(1).max(300), nodes: z.array(outlineNodeSchema),
  version: z.number().int().nonnegative(), createdAt: z.number(), updatedAt: z.number(),
}).strict()
export const createDocSchema = z.object({
  title: z.string().trim().min(1).max(300), nodes: z.array(outlineNodeSchema).default([]),
}).strict()

export const opSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("retitle"), title: z.string().trim().min(1).max(300) }).strict(),
  z.object({ kind: z.literal("insert"), parentId: z.string().min(1).nullable(), index: z.number().int().min(0), text: z.string().max(2000) }).strict(),
  z.object({ kind: z.literal("update"), nodeId: z.string().min(1), text: z.string().max(2000) }).strict(),
  z.object({ kind: z.literal("toggle"), nodeId: z.string().min(1), done: z.boolean() }).strict(),
  z.object({ kind: z.literal("move"), nodeId: z.string().min(1), parentId: z.string().min(1).nullable(), index: z.number().int().min(0) }).strict(),
  z.object({ kind: z.literal("remove"), nodeId: z.string().min(1) }).strict(),
])
export const applyOpSchema = z.object({
  docId: z.string().min(1), version: z.number().int().nonnegative(), op: opSchema,
}).strict()

export type Document = z.infer<typeof documentSchema>
export type Op = z.infer<typeof opSchema>
export type NodeOp = Exclude<Op, { kind: "retitle" }>
export type CreateDocInput = z.input<typeof createDocSchema>
export type ApplyOpInput = z.input<typeof applyOpSchema>
