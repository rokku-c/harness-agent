import type { InspectorField } from "./inspector-types.ts"

export type FieldValues = Readonly<Record<string, string>>

const valueOf = (field: InspectorField, raw: string): unknown => {
  if (field.type === "number") {
    const value = Number(raw)
    if (!Number.isFinite(value)) throw new Error(`${field.name} must be a number`)
    return value
  }
  if (field.type === "boolean") return raw === "true"
  if (field.type === "json") {
    try {
      return JSON.parse(raw)
    } catch (error) {
      throw new Error(`${field.name} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return raw
}

export const argsOf = (fields: readonly InspectorField[], values: FieldValues): Record<string, unknown> => {
  const args: Record<string, unknown> = {}
  for (const field of fields) {
    const raw = values[field.name] ?? ""
    if (raw.trim() === "") continue
    args[field.name] = valueOf(field, raw)
  }
  return args
}

export interface CallResult {
  readonly ok: boolean
  readonly result?: unknown
  readonly error?: string
}

export const callTool = async (id: string, name: string, args: unknown): Promise<CallResult> => {
  const response = await fetch(
    `/console/api/tools/${encodeURIComponent(id)}/${encodeURIComponent(name)}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args), cache: "no-store" },
  )
  return await response.json() as CallResult
}
