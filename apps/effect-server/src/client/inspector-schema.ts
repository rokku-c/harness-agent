import type { InspectorField } from "./inspector-types.ts"

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}

const strings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const typeOf = (schema: Record<string, unknown>): InspectorField["type"] => {
  switch (schema.type) {
    case "string": return "string"
    case "boolean": return "boolean"
    case "integer":
    case "number": return "number"
    default: return "json"
  }
}

const fallbackOf = (schema: Record<string, unknown>): string | undefined => {
  if (!("default" in schema)) return undefined
  const value = schema.default
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

const fieldOf = (name: string, spec: unknown, required: boolean): InspectorField => {
  const schema = record(spec)
  const choices = strings(schema.enum)
  const fallback = fallbackOf(schema)
  const optional = { ...(typeof schema.description === "string" ? { description: schema.description } : {}),
    ...(fallback === undefined ? {} : { fallback }),
    required: required && fallback === undefined }
  return choices.length > 0
    ? { name, type: "choice", choices, ...optional }
    : { name, type: typeOf(schema), ...optional }
}

export const fieldsOf = (schema: unknown): readonly InspectorField[] => {
  const root = record(schema)
  const required = new Set(strings(root.required))
  return Object.entries(record(root.properties)).map(([name, spec]) => fieldOf(name, spec, required.has(name)))
}

export const initialValues = (fields: readonly InspectorField[]): Record<string, string> =>
  Object.fromEntries(fields.filter((field) => field.required && field.type === "boolean")
    .map((field) => [field.name, "false"]))
