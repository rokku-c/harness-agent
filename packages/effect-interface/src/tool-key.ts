/**
 * The name a tool is addressed by, and the JSON Schema that advertises it.
 *
 * A tool's key is its interface id and its name joined by a dot — the flat
 * namespace the registry, the MCP surface, and the docs all address tools in.
 * `Formal/ToolKey.lean` proves a dot-free id splits back into exactly the pair
 * that made it, which is what lets a caller split a key it was handed.
 *
 * Both are pure functions of (interface id, tool) and hold no state, so they
 * live apart from the registry that applies them.
 */

import type { EffectTool, ToolJsonSchema } from "./contract.ts"
import { toJsonSchema } from "./contract.ts"

export interface ToolEntry {
  readonly key: string
  readonly interfaceId: string
  readonly tool: EffectTool
}

/** The flat key a tool is addressed by: "interfaceId.toolName". */
export const keyOf = (ifaceId: string, toolName: string): string => ifaceId + "." + toolName

/**
 * The tool as MCP and the docs see it. A declared `inputSchema` wins, a zod
 * `input` is lowered when there is one, and a tool that declares neither takes
 * an object — a served tool takes arguments even when it accepts any.
 */
export const schemaOf = (ifaceId: string, tool: EffectTool): ToolJsonSchema => {
  const parameters =
    tool.inputSchema ?? (tool.input !== undefined ? toJsonSchema(tool.input) : undefined) ?? { type: "object" }
  const output =
    tool.outputSchema ?? (tool.output !== undefined ? toJsonSchema(tool.output) : undefined)
  return {
    name: keyOf(ifaceId, tool.name),
    description: tool.description,
    parameters,
    ...(output !== undefined ? { output } : {}),
  }
}
