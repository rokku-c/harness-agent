/**
 * The tool projection: the same list, as the tools an agent calls over MCP or
 * any other tool transport.
 *
 * A tool's arguments are the operation's input schema, and the JSON Schema the
 * transport advertises is generated from it, so what a model sees, what a tool
 * call is validated against, and what an HTTP request is validated against are
 * one declaration.
 */
import { toJsonSchema, type EffectTool } from "../contract.ts"
import type { Operation } from "./operation.ts"

export const toEffectTools = (operations: readonly Operation[]): readonly EffectTool[] =>
  operations.map((op) => ({
    name: op.name,
    description: op.description,
    input: op.input,
    inputSchema: toJsonSchema(op.input),
    // a tool call carries no HTTP request: an operation that needs a credential
    // declares it as an argument instead of taking it from a header
    handler: (input: unknown) => op.handler(input as never, {}),
  }))
