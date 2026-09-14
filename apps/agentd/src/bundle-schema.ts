import { z } from "@effect-agent/effect-config"

const bundleBase = z.object({
  bundleId: z.string().min(1), version: z.string().min(1), abi: z.string().min(1),
  runtimes: z.array(z.enum(["os", "browser", "sandbox"])).min(1).optional(),
  kind: z.enum(["app", "kernel"]).default("app"),
  bootstrapAbi: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
}).strict()
const refineBundle = (value: { kind: "app" | "kernel"; bootstrapAbi?: string }, ctx: z.RefinementCtx): void => {
  if (value.kind === "kernel" && value.bootstrapAbi === undefined) {
    ctx.addIssue({ code: "custom", message: "a kernel bundle must declare bootstrapAbi" })
  }
  if (value.kind === "app" && value.bootstrapAbi !== undefined) {
    ctx.addIssue({ code: "custom", message: "an app bundle must not declare bootstrapAbi; that line is host↔kernel" })
  }
}
export const bundle = bundleBase.superRefine(refineBundle)
