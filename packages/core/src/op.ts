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

export const schemaJson = <A>(schema: Schema.Schema<A, any, never>): Record<string, unknown> =>
  JSONSchema.make(schema) as unknown as Record<string, unknown>

export type DecodeError = { readonly _tag: "DecodeError"; readonly cause: unknown }

export const decode = <A>(schema: Schema.Schema<A, any, never>, value: unknown): Effect.Effect<A, DecodeError> =>
  Schema.decodeUnknown(schema)(value).pipe(
    Effect.mapError((cause): DecodeError => ({ _tag: "DecodeError", cause }))
  )

export const decodeJson = <A>(schema: Schema.Schema<A, any, never>, text: string): Effect.Effect<A, DecodeError> =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: (cause): DecodeError => ({ _tag: "DecodeError", cause })
  }).pipe(Effect.flatMap((value) => decode(schema, value)))

