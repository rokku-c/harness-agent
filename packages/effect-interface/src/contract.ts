/**
 * effect-interface contract — zod-first, schema-exportable interfaces.
 *
 * One zod schema is the single source of truth for each tool's input/output:
 * it produces the runtime types (`z.infer`), the validator (`safeParse`) and
 * the exportable JSON Schema (`z.toJSONSchema`). There is deliberately no
 * separate "wire format" — what you author is exactly what you export.
 */

import { z } from "zod"

export interface EffectTool<I = unknown, O = unknown> {
  readonly name: string
  readonly title?: string
  readonly description?: string
  /** input contract — zod, hence types + validator + JSON Schema in one. */
  readonly input?: z.ZodType<I>
  /** ready-made JSON Schema (for tools discovered over MCP / external plugins). */
  readonly inputSchema?: unknown
  /** optional output contract; when present it is validated & schema-exported. */
  readonly output?: z.ZodType<O>
  /** ready-made JSON Schema for the output. */
  readonly outputSchema?: unknown
  /** the actual behaviour. Registered implementations are swappable. */
  readonly handler: (input: I) => O | Promise<O>
}

export interface EffectApp {
  /** stable id, e.g. "console" or the ui:// resource path segment. */
  readonly id: string
  readonly title?: string
  readonly description?: string
  /** ui:// resource uri when the app is an MCP Apps UI resource. */
  readonly resourceUri?: string
  /** host route where the app's LIVE UI is served (for the switcher). */
  readonly path?: string
  /**
   * How a host draws this app in its launcher: a short mark and one of the
   * design system's colour names. The app declares them, so a host holds no
   * table of app ids and adding an app never means editing the host.
   */
  readonly icon?: string
  readonly color?: string
}

export interface EffectInterface {
  /** stable id, e.g. "apps/board". */
  readonly id: string
  readonly title?: string
  readonly description?: string
  readonly tools: readonly EffectTool[]
  /** UIs this interface/plugin serves (registered alongside the tools). */
  readonly apps?: readonly EffectApp[]
}

/** JSON-Schema projection of a zod type (schema-exportable interface). */
export const toJsonSchema = (schema: z.ZodType): unknown => z.toJSONSchema(schema)

export interface ToolJsonSchema {
  readonly name: string
  readonly description?: string
  readonly parameters: unknown
  readonly output?: unknown
}

/** Validate + run one registered tool's handler. */
export async function invoke<I, O>(
  tool: EffectTool<I, O>,
  raw: unknown,
): Promise<O> {
  let data: unknown = raw
  if (tool.input !== undefined) {
    const parsed = tool.input.safeParse(raw)
    if (!parsed.success) {
      throw new Error(
        `invalid arguments for ${tool.name}: ` +
          parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
      )
    }
    data = parsed.data
  }
  const out = await tool.handler(data as I)
  if (tool.output !== undefined) {
    const checked = tool.output.safeParse(out)
    if (!checked.success) {
      throw new Error(
        `invalid result from ${tool.name}: ` +
          checked.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
      )
    }
    return checked.data as O
  }
  return out as O
}
