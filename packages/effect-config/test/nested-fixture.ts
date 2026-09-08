import { z, type ConfigDeclaration } from "../src/index.ts"

/** Nested configuration used to exercise top-level patch and unset semantics. */
export const nested: ConfigDeclaration = {
  appId: "demo",
  schema: z.object({
    route: z.object({ path: z.string(), label: z.string().default("unlabeled"),
      delay: z.number().positive().default(1), color: z.string().optional() }),
    note: z.string().default("default"),
    enabled: z.boolean().default(false),
  }),
  default: { route: { path: "/default" } },
}
