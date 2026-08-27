/** JSON-compatible values used by all serializable core declarations. */
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | ReadonlyArray<JsonValue> | { readonly [key: string]: JsonValue }

/** Portable JSON Schema subset. Adapters may support additional JSON Schema fields. */
export interface JsonSchema {
  readonly type?: "null" | "string" | "number" | "integer" | "boolean" | "object" | "array"
  readonly title?: string
  readonly description?: string
  readonly enum?: ReadonlyArray<JsonValue>
  readonly properties?: Readonly<Record<string, JsonSchema>>
  readonly required?: ReadonlyArray<string>
  readonly items?: JsonSchema
  readonly additionalProperties?: boolean | JsonSchema
}
