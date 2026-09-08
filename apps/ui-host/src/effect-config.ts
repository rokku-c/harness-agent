/**
 * Schema-declared configuration for the ui-host app.
 *
 * Declared via @effect-agent/effect-config: one zod schema is the single
 * source of truth for the ui runtime host's knobs, layered as
 * schema default  <-  effect.yaml `config:`  <-  runtime override.
 *
 * Field names mirror the ui-host console (see src/standalone.ts UI_PORT default
 * 4870) and the ui-renderer registry (webRenderer id "web-html",
 * jsonReactRenderer id "json-render-react").
 */

import { z, type ConfigDeclaration } from "@effect-agent/effect-config"

const schema = z.object({
  /** host the standalone ui-host web server binds to */
  host: z.string().default("127.0.0.1"),
  /** port the standalone ui-host web server binds to */
  port: z.number().int().default(4870),
  /** SQLite activity state, isolated per loaded instance */
  databaseFile: z.string().default(".effect-agent/ui.sqlite"),
  /** console theme */
  theme: z.enum(["warm-paper", "dusk"]).default("warm-paper"),
  /** default renderer for the console canvas */
  renderer: z.enum(["web-html", "json-render-react"]).default("web-html"),
})

export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "ui-host",
  title: "ui-host",
  description: "ui runtime host (/ui)",
  schema,
}
