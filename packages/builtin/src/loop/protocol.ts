/**
 * loop/protocol.ts - the MODEL-FACING PROJECTION of a run.
 *
 * Concept: what the model may see and call this step. The driver has a
 * granted op surface (read ops always, write ops only where write access was
 * granted) plus, when the run asks for a structured result, ONE protocol
 * tool whose input schema IS that result. Naming and description come from
 * the agent declaration (until.schema asTool) - core only wires the shape.
 * Pure functions: no session state, no effects.
 */
import type { Op } from "@effect-agent/core"
import { schemaJson } from "@effect-agent/core"
import type { LoopState, EffectAgentOptions } from "./types.ts"
import type { WireTool } from "../wire.ts"

/** the protocol tool carrying a run's structured result (until: Schema) */
export interface FinalTool {
  readonly name: string
  readonly description: string
  readonly schema: unknown
}

/** structured-result boundary data as the agent declared it (asTool?) */
export interface StructuredBoundary {
  readonly schema: unknown
  readonly asTool?: { readonly name: string; readonly description?: string }
}

/** derive the protocol tool from the boundary, unless the name is taken */
export const finalToolFor = (
  boundary: StructuredBoundary | undefined,
  byName: Map<string, Op<any, any, any, any>>
): FinalTool | undefined => {
  if (boundary === undefined || boundary.asTool === undefined || byName.has(boundary.asTool.name)) return undefined
  return {
    name: boundary.asTool.name,
    description: boundary.asTool.description ?? "Return the run's structured final result (this tool's input schema is the required output).",
    schema: boundary.schema
  }
}

/** plan which granted ops the model sees this step (context economy) */
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

/** wire projection of one step: granted ops + the protocol tool */
export const wireTools = (
  surface: ReadonlyArray<Op<any, any, any, any>>,
  finalTool: FinalTool | undefined
): ReadonlyArray<WireTool> => [
  ...surface.map((op) => ({ name: op.name, description: op.description, input: schemaJson(op.input) })),
  ...(finalTool === undefined ? [] : [{ name: finalTool.name, description: finalTool.description, input: schemaJson(finalTool.schema as never) }])
]

/** the guard set of visible op names (model may only call these) */
export const visibleNames = (surface: ReadonlyArray<Op<any, any, any, any>>): Set<string> =>
  new Set(surface.map((op) => op.name))
