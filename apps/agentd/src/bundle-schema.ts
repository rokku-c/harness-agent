import { z } from "@effect-agent/effect-config"

/**
 * One code artifact to distribute (§7.6). `kind` decides which of §5's two ABI
 * lines is the one that matters: an app is checked against `abi`, a kernel
 * against `bootstrapAbi` as well.
 */
const bundleBase = z.object({
  bundleId: z.string().min(1), version: z.string().min(1), abi: z.string().min(1),
  runtimes: z.array(z.enum(["os", "browser", "sandbox"])).min(1).optional(),
  kind: z.enum(["app", "kernel"]).default("app"),
  bootstrapAbi: z.string().min(1).optional(),
  /**
   * The directory this artifact's *bytes* live in (§8.2, P6) — the compiled
   * output `compileEffectBundle` writes. Absent = a version every node is
   * expected to already have; a node that has never seen it gets a named 404
   * instead of being told to run something it does not have.
   */
  source: z.string().min(1).optional(),
}).strict()
/** The two-ABI-lines rule, applied wherever an artifact is written down. */
const refineBundle = (value: { kind: "app" | "kernel"; bootstrapAbi?: string }, ctx: z.RefinementCtx): void => {
  if (value.kind === "kernel" && value.bootstrapAbi === undefined) {
    ctx.addIssue({ code: "custom", message: "a kernel bundle must declare bootstrapAbi" })
  }
  if (value.kind === "app" && value.bootstrapAbi !== undefined) {
    ctx.addIssue({ code: "custom", message: "an app bundle must not declare bootstrapAbi; that line is host↔kernel" })
  }
}
export const bundle = bundleBase.superRefine(refineBundle)
