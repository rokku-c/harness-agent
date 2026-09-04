/**
 * cc/mcp.ts - OP-TO-MCP TOOL INJECTION.
 *
 * Concept: express effect-agent binding ops as native MCP tools inside
 * Claude Code's own runtime, executed on our runtime so each op's services
 * resolve exactly as they would in-loop. Mapping is name-safe and
 * schema-faithful (see cc/schema.ts).
 */
import { Schema, Runtime } from "effect"
import * as z from "zod"
import { tool as sdkTool } from "@anthropic-ai/claude-agent-sdk"
import { schemaJson, type Op } from "@effect-agent/core"
import { safeToolName, zodFromJson } from "./schema.ts"

export interface InjectedOp {
  readonly opName: string
  readonly allowedName: string
  readonly definition: ReturnType<typeof sdkTool>
}

export const mcpTools = (ops: ReadonlyArray<Op<any, any, any, any>>, runtime: Runtime.Runtime<any>): ReadonlyArray<InjectedOp> =>
  ops.map((op) => {
    const name = safeToolName(op.name)
    const root = zodFromJson(schemaJson(op.input))
    const shape = root instanceof z.ZodObject ? root.shape : { input: root }
    return {
      opName: op.name,
      allowedName: "mcp__effect_agent__" + name,
      definition: sdkTool(name, op.description, shape, async (input) => {
        const decoded = await Runtime.runPromise(runtime)(Schema.decodeUnknown(op.input)(input))
        const output = await Runtime.runPromise(runtime)(op.execute(decoded))
        return { content: [{ type: "text" as const, text: JSON.stringify(output) }] }
      })
    }
  })
