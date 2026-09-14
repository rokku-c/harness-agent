import { toJsonSchema, type EffectTool } from "../contract.ts"
import type { Operation } from "./operation.ts"

export const toEffectTools = (operations: readonly Operation[]): readonly EffectTool[] =>
  operations.map((op) => ({
    name: op.name,
    description: op.description,
    input: op.input,
    inputSchema: toJsonSchema(op.input),
    handler: (input: unknown) => op.handler(input as never, {}),
  }))
