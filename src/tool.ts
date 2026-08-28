/**
 * Typed tools: Effect Schema in/out with a fully typed execute, bridged to the
 * wire-level Tool (JSON Schema, MCP-native) automatically. The model sees JSON
 * Schema; the connection author sees types.
 */
import { Effect, JSONSchema, Schema } from "effect"
import type { ShapeTool, Tool } from "./connection.ts"
import type { NotationText } from "./notation.ts"

export interface TypedTool<I, O, E = never> {
  readonly name: string
  /** Model-facing prose - notation-injected. */
  readonly description?: NotationText
  /** Decoded, typed input. */
  readonly input: Schema.Schema<I, I, never>
  readonly output: Schema.Schema<O, O, never>
  readonly execute: (input: I) => Effect.Effect<O, E>
}

export const make = <I, O, E = never>(tool: TypedTool<I, O, E>): TypedTool<I, O, E> => tool

/** Bridge a typed tool to the wire-level Tool: Schema -> JSON Schema, decode in, encode out. */
export const toTool = <I, O, E>(typed: TypedTool<I, O, E>): Tool => ({
  name: typed.name,
  description: typed.description,
  input: JSONSchema.make(typed.input) as unknown as Record<string, unknown>,
  output: JSONSchema.make(typed.output) as unknown as Record<string, unknown>,
  execute: (input: unknown) =>
    Effect.flatMap(Schema.decodeUnknown(typed.input)(input), (decoded) =>
      Effect.flatMap(typed.execute(decoded), (output) =>
        Effect.map(Schema.encode(typed.output)(output), (encoded) => encoded as unknown)))
})

/** The shape a typed tool list declares (for the shaped / named+shaped modes). */
export const shapeOf = <I, O, E>(tools: ReadonlyArray<TypedTool<I, O, E>>): ReadonlyArray<ShapeTool> =>
  tools.map((tool) => ({
    name: tool.name,
    input: JSONSchema.make(tool.input) as unknown as Record<string, unknown>,
    output: JSONSchema.make(tool.output) as unknown as Record<string, unknown>
  }))
