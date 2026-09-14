import { z } from "zod"

export interface EffectTool<I = unknown, O = unknown> {
  readonly name: string
  readonly title?: string
  readonly description?: string
  readonly input?: z.ZodType<I>
  readonly inputSchema?: unknown
  readonly output?: z.ZodType<O>
  readonly outputSchema?: unknown
  readonly handler: (input: I) => O | Promise<O>
}

export interface EffectApp {
  readonly id: string
  readonly title?: string
  readonly description?: string
  readonly resourceUri?: string
  readonly path?: string
  readonly icon?: string
  readonly color?: string
}

export interface EffectInterface {
  readonly id: string
  readonly title?: string
  readonly description?: string
  readonly tools: readonly EffectTool[]
  readonly apps?: readonly EffectApp[]
}

export const toJsonSchema = (schema: z.ZodType): unknown => z.toJSONSchema(schema)

export interface ToolJsonSchema {
  readonly name: string
  readonly description?: string
  readonly parameters: unknown
  readonly output?: unknown
}

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
