/**
 * cc/schema.ts - JSON-SCHEMA TRANSLATION (core <=> claude SDK).
 *
 * Concept: project effect-agent input schemas (already in JSON Schema form)
 * into the zod shapes the claude-agent-sdk MCP tools need, and sanitize op
 * names to SDK-safe identifiers. Pure functions.
 */
import * as z from "zod"

export const safeToolName = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, "_")

export const zodFromJson = (schema: any): z.ZodType => {
  if (schema === undefined || schema === null) return z.any()
  if (schema.enum && Array.isArray(schema.enum)) {
    if (schema.enum.length === 1) return z.literal(schema.enum[0])
    return z.enum(schema.enum)
  }
  switch (schema.type) {
    case "string":
      return z.string()
    case "number":
    case "integer":
      return z.number()
    case "boolean":
      return z.boolean()
    case "array":
      return z.array(zodFromJson(schema.items))
    case "object": {
      const shape: Record<string, z.ZodType> = {}
      const properties = schema.properties ?? {}
      for (const [key, value] of Object.entries(properties)) shape[key] = zodFromJson(value)
      if (Object.keys(shape).length === 0) return z.record(z.string(), z.any())
      const object = z.object(shape)
      return schema.additionalProperties === false ? object.strict() : object
    }
    default:
      return schema.type === "null" ? z.null() : z.any()
  }
}
