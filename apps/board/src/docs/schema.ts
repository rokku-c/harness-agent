/**
 * A document is an OUTLINE: nested, ordered nodes with text and a done mark.
 * That shape is the whole collaboration model - two people editing different
 * parts of one outline is the normal case, so the API takes one operation at a
 * time against a version rather than a whole document, and the store refuses a
 * write built on a version someone else has already moved past.
 */
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

/** One edit. `null` parentId means the top level. */
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
/** Operations that rewrite the outline; `retitle` changes the document, not the tree. */
export type NodeOp = Exclude<Op, { kind: "retitle" }>
export type CreateDocInput = z.input<typeof createDocSchema>
export type ApplyOpInput = z.input<typeof applyOpSchema>
