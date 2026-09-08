/**
 * effect-ui schema — zod declaration for an EffectUiView, plus JSON-Schema
 * export so a view contract can be shipped to (and validated by) any host.
 */

import { z } from "zod"
import type { EffectUiView, UiNodeSpec } from "./spec.ts"

/** Recursive zod schema for the closed UiNodeSpec union. */
export const viewSpecSchema = (): z.ZodType<EffectUiView> => {
  const nodeSchema: z.ZodType<UiNodeSpec> = z.lazy(() =>
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("text"), id: z.string().optional(), bind: z.string().optional(), text: z.string() }),
      z.object({
        kind: z.literal("stack"),
        id: z.string().optional(),
        gap: z.number().optional(),
        direction: z.enum(["horizontal", "vertical"]).optional(),
        children: z.array(z.lazy(() => nodeSchema)),
      }),
      z.object({
        kind: z.literal("button"),
        id: z.string().optional(),
        label: z.string(),
        bind: z.string().optional(),
        onPress: z.string().optional(),
      }),
      z.object({
        kind: z.literal("formField"),
        id: z.string().optional(),
        label: z.string(),
        bind: z.string().optional(),
        value: z.string().optional(),
        placeholder: z.string().optional(),
      }),
      z.object({ kind: z.literal("list"), id: z.string().optional(), items: z.array(z.string()) }),
    ]),
  )
  return z.object({ viewId: z.string(), title: z.string().optional(), nodes: z.array(nodeSchema) })
}

/** Export the view contract as JSON Schema (draft 2020-12). */
export const viewToJsonSchema = (): Record<string, unknown> =>
  z.toJSONSchema(viewSpecSchema()) as unknown as Record<string, unknown>
