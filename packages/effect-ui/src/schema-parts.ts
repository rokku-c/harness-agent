/**
 * The leaf shapes a view contract is built from: how a value is referred to, how
 * a list repeats, when a node is shown, and what an action is.
 *
 * These are the parts that carry no recursion — a source is a source, an action
 * is an action — which is what makes them a layer of their own rather than the
 * first half of `schema.ts`. The one rule that needs stating is on the action,
 * because an action is the only place a view says what a press *does*, and it
 * now says it in one of two ways.
 */

import { z } from "zod"

export const stateRef = z.object({ state: z.string() })
export const itemRef = z.object({ item: z.string() })
export const actionParam = z.union([z.string(), z.number(), z.boolean(), z.null(), stateRef, itemRef])
export const repeat = z.object({ source: z.union([stateRef, itemRef]), key: z.string().optional() })
export const condition = z.object({
  source: z.union([stateRef, itemRef]),
  // a state path here is a comparison against a live value, not a literal
  equals: z.union([z.string(), z.number(), z.boolean(), z.null(), stateRef]).optional(),
  not: z.boolean().optional(),
})
export const visible = z.union([condition, z.object({ any: z.array(condition) })])
export const source = z.object({ id: z.string().min(1), url: z.string().min(1), state: z.string().min(1), refreshMs: z.number().positive().optional() })

/**
 * A press calls an address, enters a screen, or re-runs the reads it names — the
 * first two together being what opening a record is, where the read fills
 * `result` and the screen renders it, and the third being the retry, whose whole
 * work is the read it repeats. Any one of them is a press that does something. A
 * view that declares none is a button that silently does nothing in the browser,
 * so it is refused here.
 */
export const action = z.object({
  name: z.string().min(1),
  method: z.enum(["GET", "POST", "PATCH", "DELETE"]).optional(),
  url: z.string().min(1).optional(),
  opens: z.string().min(1).optional(),
  params: z.record(z.string(), actionParam).optional(),
  result: z.string().min(1).optional(),
  clear: z.array(z.string()).optional(),
  refresh: z.array(z.string()).optional(),
}).superRefine((value, ctx) => {
  if (value.url === undefined && value.opens === undefined && (value.refresh ?? []).length === 0) {
    ctx.addIssue({ code: "custom", path: ["url"], message: "an action calls a url, opens a screen, or re-runs a read; this one does none" })
  }
})
