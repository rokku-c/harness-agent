import { z } from "zod"
import type { EffectUiView, UiNode } from "./spec.ts"
import { ROOT_SCREEN } from "./screen.ts"
import { action, actionParam, repeat, source, visible } from "./schema-parts.ts"

const NODE_FIELDS = ["component", "props", "children", "id", "bind", "item", "as", "repeat", "visible", "onPress", "params"] as const

const nodeProps = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  for (const field of NODE_FIELDS) {
    if (field in value) {
      ctx.addIssue({ code: "custom", path: [field], message: `"${field}" is a node field, not a prop. Write it beside props, not inside them.` })
    }
  }
})

export const viewSpecSchema = (): z.ZodType<EffectUiView> => {
  const nodeSchema: z.ZodType<UiNode> = z.lazy(() => z.object({
    component: z.string().min(1),
    props: nodeProps.optional(),
    children: z.array(z.lazy(() => nodeSchema)).optional(),
    id: z.string().optional(),
    bind: z.string().optional(),
    item: z.string().optional(),
    as: z.string().optional(),
    repeat: repeat.optional(),
    visible: visible.optional(),
    onPress: z.string().optional(),
    params: z.record(z.string(), actionParam).optional(),
  }))
  const screenSchema = z.object({
    id: z.string().min(1), title: z.string().min(1), parent: z.string().min(1).optional(),
    onEnter: z.string().min(1).optional(), nodes: z.array(nodeSchema),
  })
  const screens = z.array(screenSchema).superRefine((value, ctx) => {
    value.forEach((screen, index) => {
      if (screen.id === ROOT_SCREEN) {
        ctx.addIssue({ code: "custom", path: [index, "id"], message: `"${ROOT_SCREEN}" is the screen \`nodes\` already is; this one needs its own id` })
      }
    })
  })
  return z.object({
    viewId: z.string(), title: z.string().optional(), layout: z.enum(["screen", "flow"]).optional(),
    state: z.record(z.string(), z.unknown()).optional(),
    sources: z.array(source).optional(), actions: z.array(action).optional(), nodes: z.array(nodeSchema),
    screens: screens.optional(),
  })
}

export const viewToJsonSchema = (): Record<string, unknown> =>
  z.toJSONSchema(viewSpecSchema()) as unknown as Record<string, unknown>
