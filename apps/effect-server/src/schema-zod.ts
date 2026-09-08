/**
 * JSON-Schema -> zod shape bridge (small, intentional subset).
 *
 * Tools discovered over MCP only carry a JSON Schema; to serve them through
 * the MCP SDK we re-derive a zod input shape for the common object case.
 */

import { z } from "zod"

const field = (s: { type?: string; enum?: readonly string[]; items?: unknown }): z.ZodType => {
  switch (s.type) {
    case "string":
      return s.enum !== undefined && s.enum.length > 0 ? z.enum(s.enum as [string, ...string[]]) : z.string()
    case "number":
      return z.number()
    case "integer":
      return z.number().int()
    case "boolean":
      return z.boolean()
    case "array":
      return z.array(field(s.items as never))
    case "object":
      return z.object(zodShapeFromJsonSchema(s as never))
    default:
      return z.unknown()
  }
}

export const zodShapeFromJsonSchema = (
  schema: { type?: string; properties?: Record<string, unknown>; required?: string[] } | undefined,
): Record<string, z.ZodType> => {
  if (schema?.type !== "object" || schema.properties === undefined) return {}
  const required = new Set(schema.required ?? [])
  const shape: Record<string, z.ZodType> = {}
  for (const [key, value] of Object.entries(schema.properties)) {
    const base = field(value as never)
    shape[key] = required.has(key) ? base : base.optional()
  }
  return shape
}
