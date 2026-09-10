import type { ConfigElementSpec } from "./config-spec.ts"
type JsonField = { type?: string; enum?: readonly unknown[]; properties?: Record<string, JsonField>; required?: readonly string[] }
const kind = (s: JsonField): string => s.enum?.length ? "enum" : s.type ?? (s.properties ? "object" : "string")
const inputType = (s: JsonField): string => ["enum", "boolean"].includes(kind(s)) ? "select" : ["number", "integer"].includes(kind(s)) ? "number" : "text"
export const parseFieldValue = (node: HTMLElement, input: HTMLInputElement | HTMLSelectElement): unknown => {
  if (input.type === "checkbox") return input.checked
  if (input.value === "") return undefined
  if (node.dataset.kind === "number" || node.dataset.kind === "integer") { const value = Number(input.value); if (!Number.isFinite(value) || node.dataset.kind === "integer" && !Number.isInteger(value)) throw new Error(`Invalid ${node.dataset.kind} value`); return value }
  if (node.dataset.kind === "enum" || node.dataset.kind === "boolean") { try { return JSON.parse(input.value) } catch { return input.value } }
  return input.value
}
const lower = (elements: Record<string, ConfigElementSpec>, id: string, path: string, key: string, schema: JsonField, value: unknown, required: boolean): string => {
  const nodeKind = kind(schema)
  if (nodeKind === "object") {
    const source = value as Record<string, unknown> | undefined
    const children = Object.entries(schema.properties ?? {}).map(([name, field]) => lower(elements, `${id}-${name}`, `${path}.${name}`, name, field, source?.[name], schema.required?.includes(name) ?? false))
    elements[id] = { type: "Stack", props: { direction: "vertical", role: "array-row", fieldPath: path, arrayRow: true }, children }; return id
  }
  elements[id] = { type: "Input", props: { label: key, value: String(value ?? ""), rawValue: value, inputType: inputType(schema), fieldKind: nodeKind, fieldPath: path, arrayRow: true, options: schema.enum ?? (nodeKind === "boolean" ? [true, false] : undefined), required, unset: value === undefined, checked: value === true } }; return id
}
export const rewriteArrayRowPaths = (elements: Record<string, ConfigElementSpec>, rowId: string, path: string): void => {
  const node = elements[rowId], old = String(node?.props?.fieldPath ?? "")
  const rewrite = (id: string): void => { const child = elements[id]; if (!child) return; const current = String(child.props?.fieldPath ?? ""); if (current.startsWith(old)) child.props = { ...(child.props ?? {}), fieldPath: `${path}${current.slice(old.length)}` }; (child.children ?? []).forEach(rewrite) }
  rewrite(rowId)
}
export const appendArrayRow = (elements: Record<string, ConfigElementSpec>, arrayId: string, index: number, item: JsonField): string => {
  const array = elements[arrayId], path = `${String(array.props?.fieldPath ?? arrayId)}.${index}`, rowId = `${arrayId}-row-${index}-${Object.keys(elements).length}`
  lower(elements, rowId, path, String(index + 1), item, undefined, true); return rowId
}
