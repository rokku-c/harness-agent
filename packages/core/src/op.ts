import { Effect, JSONSchema, Schema } from "effect"
import type { NotationText } from "./notation.ts"

/**
 * The typed capability operation: Schema-typed input and output, a
 * notation-resolved description (the prose rule), and a declared access
 * mode. Ops are what bindings expose and agents call.
 */
export interface Op<I, O, E = never, R = never> {
  readonly name: string
  readonly description: NotationText
  readonly input: Schema.Schema<I, any, never>
  readonly output: Schema.Schema<O, any, never>
  readonly access: "read" | "write"
  readonly execute: (input: I) => Effect.Effect<O, E, R>
}

export const Op = {
  read: <I, O, E = never, R = never>(spec: Omit<Op<I, O, E, R>, "access">): Op<I, O, E, R> => ({ ...spec, access: "read" }),
  write: <I, O, E = never, R = never>(spec: Omit<Op<I, O, E, R>, "access">): Op<I, O, E, R> => ({ ...spec, access: "write" })
}

/**
 * Serialize an op input to the JSON Schema providers expect in tool
 * input_schema.
 *
 * Effect's JSONSchema.make emits draft-07 boilerplate that tool APIs reject:
 *   - a relative "$id" (e.g. "/schemas/%7B%7D") - Anthropic aborts with
 *     "relative URL without a base";
 *   - an empty struct degrades to a bogus anyOf(object, array) instead of
 *     a plain object schema.
 * We strip the document keys and normalize the empty-struct case so every
 * provider receives a clean, conventional object schema.
 */
export const schemaJson = <A>(schema: Schema.Schema<A, any, never>): Record<string, unknown> => {
  const raw = JSONSchema.make(schema) as unknown as Record<string, unknown>
  const { $schema: _doc, $id: _id, anyOf, ...rest } = raw
  if (rest.type === undefined && Array.isArray(anyOf) && anyOf.every((b) => typeof b === "object" && b !== null && !("properties" in b)))
    rest.type = "object"
  else if (rest.type !== undefined) rest.type = rest.type
  return rest
}

export type DecodeError = { readonly _tag: "DecodeError"; readonly cause: unknown }

export const decode = <A>(schema: Schema.Schema<A, any, never>, value: unknown): Effect.Effect<A, DecodeError> =>
  Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((cause): DecodeError => ({ _tag: "DecodeError", cause }))
  )
