import type { Op } from "@effect-agent/core"
import { schemaJson } from "@effect-agent/core"
import type { LoopState, EffectAgentOptions } from "./types.ts"
import type { WireTool } from "@effect-agent/model"

export interface FinalTool {
  readonly name: string
  readonly description: string
  readonly schema: unknown
}

export interface StructuredBoundary {
  readonly schema: unknown
  readonly asTool?: { readonly name: string; readonly description?: string }
}

export const finalToolFor = (
  boundary: StructuredBoundary | undefined,
  byName: Map<string, Op<any, any, any, any>>
): FinalTool | undefined => {
  if (boundary === undefined) return undefined
  if (boundary.asTool === undefined || typeof boundary.asTool.name !== "string" || !boundary.asTool.name.trim())
    throw new Error("EffectAgent structured output requires Until.schema with a named asTool declaration")
  if (byName.has(boundary.asTool.name))
    throw new Error("Structured result asTool name conflicts with a granted operation")
  return {
    name: boundary.asTool.name,
    description: boundary.asTool.description ?? "",
    schema: boundary.schema
  }
}

export const planSurface = (
  allOps: ReadonlyArray<Op<any, any, any, any>>,
  planTools: EffectAgentOptions["planTools"],
  state: LoopState
): ReadonlyArray<Op<any, any, any, any>> => {
  if (planTools === undefined) return allOps
  const names = planTools(state)
  if (names === undefined) return allOps
  return allOps.filter((op) => names.includes(op.name))
}

export const wireTools = (
  surface: ReadonlyArray<Op<any, any, any, any>>,
  finalTool: FinalTool | undefined
): ReadonlyArray<WireTool> => [
  ...surface.map((op) => ({ name: op.name, description: op.description, input: schemaJson(op.input) })),
  ...(finalTool === undefined ? [] : [{ name: finalTool.name, description: finalTool.description, input: schemaJson(finalTool.schema as never) }])
]

export const visibleNames = (surface: ReadonlyArray<Op<any, any, any, any>>): Set<string> =>
  new Set(surface.map((op) => op.name))
