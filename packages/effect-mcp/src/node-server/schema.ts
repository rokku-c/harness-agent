import { z } from "zod"
export interface JsonField { readonly type?: string; readonly enum?: readonly unknown[] }
export interface JsonSchema { readonly type?: string; readonly properties?: Readonly<Record<string, JsonField>>; readonly required?: readonly string[] }
const zodField = (s: JsonField): z.ZodType => { switch (s.type) { case "string": return s.enum?.length ? z.enum(s.enum as [string, ...string[]]) : z.string(); case "number": return z.number(); case "integer": return z.number().int(); case "boolean": return z.boolean(); default: return z.unknown() } }
export const zodShape = (schema?: JsonSchema): Record<string, z.ZodType> => { if (!schema?.properties) return {}; const required = new Set(schema.required ?? []); return Object.fromEntries(Object.entries(schema.properties).map(([k, f]) => { const b = zodField(f); return [k, required.has(k) ? b : b.optional()] })) }
