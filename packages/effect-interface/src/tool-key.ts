import type { EffectTool, ToolJsonSchema } from "./contract.ts"
import { toJsonSchema } from "./contract.ts"

export interface ToolEntry {
  readonly key: string
  readonly interfaceId: string
  readonly tool: EffectTool
}

export const keyOf = (ifaceId: string, toolName: string): string => ifaceId + "." + toolName

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
