import type { FormDocument, FormNode, JsonField, JsonSchema } from "./types.ts"

/** Dependency-free factory, shared verbatim with the no-build browser runtime. */
export function createFormModel() {
  let sequence = 0
  const build = (key: string, schema: JsonField, input: unknown, required = false): FormNode => {
    const value = input === undefined ? schema.default : input
    const node: FormNode = {
      id: `cfg-${++sequence}`, key, schema, required, value, present: value !== undefined,
      kind: schema.enum?.length ? "enum" : schema.type ?? (schema.properties ? "object" : "string"), fields: [], rows: [],
    }
    if (node.kind === "object") {
      const record = value && typeof value === "object" ? value as Record<string, unknown> : {}
      node.fields = Object.entries(schema.properties ?? {}).map(([name, field]) =>
        build(name, field, record[name], schema.required?.includes(name)))
    }
    if (node.kind === "array" && schema.items) {
      const values = Array.isArray(value) ? value : []
      node.rows = values.map((entry, index) => build(String(index + 1), schema.items!, entry, true))
    }
    return node
  }
  const create = (appId: string, schema?: JsonSchema, value?: Readonly<Record<string, unknown>>,
    sources?: Readonly<Record<string, string>>): FormDocument => {
    const root = build(appId, { ...schema, type: "object" }, value ?? {}, true)
    root.fields.forEach(field => { field.source = sources?.[field.key] })
    return { appId, root, declared: schema?.properties !== undefined }
  }
  const add = (node: FormNode): FormNode => {
    if (node.kind !== "array" || !node.schema.items) throw new Error("Expected an array with an item schema")
    if (node.schema.maxItems !== undefined && node.rows.length >= node.schema.maxItems) throw new Error("Maximum array size reached")
    const row = build(String(node.rows.length + 1), node.schema.items, undefined, true)
    node.rows.push(row)
    node.present = true
    return row
  }
  const remove = (node: FormNode, index: number): void => {
    if (node.kind !== "array") throw new Error("Expected an array with an item schema")
    if (!Number.isInteger(index) || index < 0 || index >= node.rows.length) throw new Error("Invalid array index")
    node.rows.splice(index, 1)
    node.rows.forEach((row, i) => { row.key = String(i + 1) })
    node.present = true
  }
  const visit = (node: FormNode, fn: (node: FormNode) => void): void => {
    fn(node)
    node.fields.forEach(child => visit(child, fn))
    node.rows.forEach(child => visit(child, fn))
  }
  return { create, add, remove, visit }
}
export type FormModel = ReturnType<typeof createFormModel>
