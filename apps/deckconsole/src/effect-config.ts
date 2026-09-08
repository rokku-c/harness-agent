/**
 * Schema-declared configuration for the deckconsole app.
 *
 * Declared via @effect-agent/effect-config: one zod schema is the single
 * source of truth for the deckconsole control room's knobs, layered as
 * schema default  <-  effect.yaml `config:`  <-  runtime override.
 *
 * Field names mirror apps/deckconsole/src/main.ts (DECK_HOST / DECK_PORT
 * default 4851 / DECK_FILE default ".effect-agent/deckconsole.sqlite").
 */

import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

const schema = z.object({
  /** standalone listener host (not used by the embedded plugin) */
  host: z.string().default("127.0.0.1"),
  /** standalone listener port (not used by the embedded plugin) */
  port: z.number().int().default(4851),
  /** sqlite state file for launcher persistence */
  configFile: z.string().default(".effect-agent/deckconsole.sqlite"),
})

export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "deckconsole",
  title: "deckconsole",
  description: "deckconsole control room (/deck)",
  schema,
}
