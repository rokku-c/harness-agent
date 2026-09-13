/**
 * Reading a tool's input schema into form fields.
 *
 * The schema is the source of truth for what a tool accepts, so the form is
 * derived from it rather than hand-written per tool — a tool that changes its
 * arguments changes its form. We read only what a form can render: the object's
 * properties, which of them are required, a description if one was written, and
 * the type that picks the control. Nested objects and arrays become a JSON
 * field, because guessing a form for an arbitrary shape is how a form starts
 * lying about the schema.
 */

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

/**
 * What the tool does when a field is left empty. A JSON Schema marks a property
 * required and gives it a default at once — the property may be missing, and
 * then this is what the tool uses. That default is the one piece of the schema
 * an operator needs while reading the form, so it becomes the field's
 * placeholder.
 */
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
    // a property the tool will default is one the operator may leave alone
    required: required && fallback === undefined }
  return choices.length > 0
    ? { name, type: "choice", choices, ...optional }
    : { name, type: typeOf(schema), ...optional }
}

/** The fields a tool's input schema declares, in the order it declares them. */
export const fieldsOf = (schema: unknown): readonly InspectorField[] => {
  const root = record(schema)
  const required = new Set(strings(root.required))
  return Object.entries(record(root.properties)).map(([name, spec]) => fieldOf(name, spec, required.has(name)))
}

/**
 * Where the form starts. A required switch is the one field that cannot be left
 * empty — its schema demands a value and a switch has only two — so it starts
 * off, which is the only safe default. Everything else starts blank, meaning
 * "not supplied": filled in, the operator is supplying it.
 */
export const initialValues = (fields: readonly InspectorField[]): Record<string, string> =>
  Object.fromEntries(fields.filter((field) => field.required && field.type === "boolean")
    .map((field) => [field.name, "false"]))
