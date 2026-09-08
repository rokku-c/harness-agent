import type { FormDocument, FormNode } from "./types.ts"

export function createFormParser() {
  const fail = (path: string, reason: string): never => { throw new Error(`${path}: ${reason}`) }
  const scalar = (node: FormNode, path: string): unknown => {
    const { value, schema, kind } = node
    if (value === undefined || value === "") {
      if (!node.required) return undefined
      if (kind !== "string") return fail(path, "a value is required")
    }
    if (kind === "enum") {
      if (!schema.enum?.some(option => Object.is(option, value))) return fail(path, "choose a declared option")
      return value
    }
    if (kind === "boolean") {
      if (value === true || value === "true") return true
      if (value === false || value === "false") return false
      return fail(path, "expected a boolean")
    }
    if (kind === "number" || kind === "integer") {
      if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return fail(path, "expected a number")
      const number = Number(value)
      if (!Number.isFinite(number) || (kind === "integer" && !Number.isInteger(number))) return fail(path, `expected a finite ${kind}`)
      if (schema.minimum !== undefined && number < schema.minimum) return fail(path, `minimum is ${schema.minimum}`)
      if (schema.maximum !== undefined && number > schema.maximum) return fail(path, `maximum is ${schema.maximum}`)
      return number
    }
    if (kind !== "string") return fail(path, `unsupported field type ${kind}`)
    const text = String(value ?? "")
    if (schema.minLength !== undefined && text.length < schema.minLength) return fail(path, `minimum length is ${schema.minLength}`)
    if (schema.maxLength !== undefined && text.length > schema.maxLength) return fail(path, `maximum length is ${schema.maxLength}`)
    return text
  }
  const read = (node: FormNode, path: string): unknown => {
    if (node.kind === "object") {
      const pairs = node.fields.map(child => [child.key, read(child, `${path}.${child.key}`)] as const)
        .filter(([, value]) => value !== undefined)
      return pairs.length || node.required || node.present ? Object.fromEntries(pairs) : undefined
    }
    if (node.kind === "array") {
      const values = node.rows.map((child, i) => read(child, `${path}[${i}]`)).filter(value => value !== undefined)
      if (!values.length && !node.present && !node.required) return undefined
      if (node.schema.minItems !== undefined && values.length < node.schema.minItems) return fail(path, `minimum items is ${node.schema.minItems}`)
      if (node.schema.maxItems !== undefined && values.length > node.schema.maxItems) return fail(path, `maximum items is ${node.schema.maxItems}`)
      return values
    }
    return scalar(node, path)
  }
  return { parse: (form: FormDocument) => read(form.root, form.appId) as Record<string, unknown> }
}
