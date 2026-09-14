import { z } from "zod"

export const stateRef = z.object({ state: z.string() })
export const itemRef = z.object({ item: z.string() })
export const actionParam = z.union([z.string(), z.number(), z.boolean(), z.null(), stateRef, itemRef])
export const repeat = z.object({ source: z.union([stateRef, itemRef]), key: z.string().optional() })
export const condition = z.object({
  source: z.union([stateRef, itemRef]),
  equals: z.union([z.string(), z.number(), z.boolean(), z.null(), stateRef]).optional(),
  not: z.boolean().optional(),
})
export const visible = z.union([condition, z.object({ any: z.array(condition) })])
export const source = z.object({ id: z.string().min(1), url: z.string().min(1), state: z.string().min(1), refreshMs: z.number().positive().optional() })

export const confirm = z.object({ say: z.string().min(1), press: z.string().min(1) })

export const action = z.object({
  name: z.string().min(1),
  method: z.enum(["GET", "POST", "PATCH", "DELETE"]).optional(),
  url: z.string().min(1).optional(),
  opens: z.string().min(1).optional(),
  params: z.record(z.string(), actionParam).optional(),
  result: z.string().min(1).optional(),
  clear: z.array(z.string()).optional(),
  refresh: z.array(z.string()).optional(),
  confirm: confirm.optional(),
}).superRefine((value, ctx) => {
  if (value.url === undefined && value.opens === undefined && (value.refresh ?? []).length === 0) {
    ctx.addIssue({ code: "custom", path: ["url"], message: "an action calls a url, opens a screen, or re-runs a read; this one does none" })
  }
  if (value.confirm !== undefined && (value.url === undefined || (value.method ?? "POST") === "GET")) {
    ctx.addIssue({ code: "custom", path: ["confirm"], message: "a confirmation guards a write; this press makes no writing call" })
  }
})
