import { z } from "@effect-agent/effect-config"

/** The current manifest shape is exact: retired listener settings are rejected. */
export const serverSchema = z.object({
  server: z.object({ control: z.boolean().optional() }).strict().optional(),
  network: z.unknown().optional(),
  enabled: z.array(z.string()).optional(), roots: z.array(z.string()).optional(),
  bundles: z.array(z.string()).optional(),
}).strict()
