/**
 * effect-ui schema — zod declaration for an EffectUiView, plus JSON-Schema
 * export so a view contract can be shipped to (and validated by) any host.
 *
 * The leaf shapes live in `schema-parts.ts`; what is here is the two things that
 * are recursive or structural — a node, and the view around it.
 */

import { z } from "zod"
import type { EffectUiView, UiNode } from "./spec.ts"
import { ROOT_SCREEN } from "./screen.ts"
import { action, actionParam, repeat, source, visible } from "./schema-parts.ts"

/**
 * The field names this file owns.
 *
 * `props` is otherwise open on purpose: the props of a node are the props of a
 * @radix-ui/themes component, and that library — not this file — says which
 * ones exist. But one of *these* inside `props` is never a component's prop. It
 * is a node field written one level too deep, where nothing reads it: the value
 * is handed to Radix as an attribute of that name and silently never renders.
 * That is a blank cell in the browser with no error anywhere, so it is refused
 * here instead, where the message can name the field.
 */
const NODE_FIELDS = ["component", "props", "children", "id", "bind", "item", "as", "repeat", "visible", "onPress", "params"] as const

const nodeProps = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  for (const field of NODE_FIELDS) {
    if (field in value) {
      ctx.addIssue({ code: "custom", path: [field], message: `"${field}" is a node field, not a prop — write it beside props, not inside them` })
    }
  }
})

/**
 * Recursive zod schema for a node. `props` stays open on purpose: the props of
 * a node are the props of a @radix-ui/themes component, and that library — not
 * this file — is what says which ones exist.
 */
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
    id: z.string().min(1), title: z.string().min(1), parent: z.string().min(1).optional(), nodes: z.array(nodeSchema),
  })
  // `root` is the screen `nodes` already is; a second one by that name would make
  // a link to it mean either of two screens.
  const screens = z.array(screenSchema).superRefine((value, ctx) => {
    value.forEach((screen, index) => {
      if (screen.id === ROOT_SCREEN) {
        ctx.addIssue({ code: "custom", path: [index, "id"], message: `"${ROOT_SCREEN}" is the screen \`nodes\` already is — this one needs its own id` })
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

/** Export the view contract as JSON Schema (draft 2020-12). */
export const viewToJsonSchema = (): Record<string, unknown> =>
  z.toJSONSchema(viewSpecSchema()) as unknown as Record<string, unknown>
