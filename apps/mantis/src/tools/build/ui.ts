/**
 * tools/build/ui.ts - the ui_render OP.
 *
 * Concept: push an A2UI-style surface onto the operator console. The spec is
 * parsed against the official v0.9 protocol; malformed specs fail with the
 * parser's reason, and with no console connected the tool says so clearly -
 * never a silent no-op.
 */
import { Effect, Schema } from "effect"
import { Op } from "@effect-agent/core"
import { manifestDescription } from "../schemas.ts"
import { parseA2uiBatch } from "../../hosts/webui/a2ui.ts"

export const buildUiRender = (push?: (spec: unknown) => void) =>
  Op.write({
    name: "ui_render",
    description: manifestDescription("ui_render"),
    input: Schema.Struct({ spec: Schema.String }),
    output: Schema.Struct({ ok: Schema.Boolean, detail: Schema.String }),
    execute: ({ spec }) => {
      if (push === undefined) return Effect.succeed({ ok: false, detail: "no UI console connected" })
      const result = parseA2uiBatch(spec)
      if (result.error !== undefined) return Effect.succeed({ ok: false, detail: result.error })
      push(result.messages)
      return Effect.succeed({ ok: true, detail: "A2UI surface rendered" })
    }
  })
