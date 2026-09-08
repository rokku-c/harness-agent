/**
 * formOf — build the interactive <form> for one parity action.
 *
 * Inputs are generated from the action's inputSchema — the same JSON schema the
 * agent tool validates against — so a human can fill in and act identically.
 */

import type { ParityAction } from "./types.ts"

/** Minimal structural view of a JSON schema, enough to drive form fields. */
interface JsonSchema {
  readonly type?: string | readonly string[]
  readonly description?: string
  readonly enum?: readonly unknown[]
  readonly properties?: Readonly<Record<string, JsonSchema | undefined>>
  readonly required?: readonly string[]
}

export const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")

const typesOf = (s: JsonSchema): readonly string[] => {
  const t = s.type
  if (t === undefined) return []
  if (typeof t === "string") return [t]
  return t
}

const kindOf = (s: JsonSchema): string => {
  if (s.enum !== undefined) return "select"
  const t = typesOf(s)
  if (t.includes("boolean")) return "boolean"
  if (t.includes("integer") || t.includes("number")) return "number"
  if (t.includes("array") || t.includes("object") || s.properties !== undefined) return "json"
  return "text"
}

const controlFor = (key: string, prop: JsonSchema, actionId: string, required: boolean): string => {
  const id = `${actionId}-${key}`
  const label = esc(prop.description ?? key)
  const base = `name="${esc(key)}" id="${id}" aria-label="${label}"`
  const req = required ? " required" : ""
  switch (kindOf(prop)) {
    case "select":
      return `<select ${base}${req}>` +
        prop.enum!.map((v) => `<option value="${esc(String(v))}">${esc(String(v))}</option>`).join("") +
        `</select>`
    case "boolean":
      return `<input type="checkbox" ${base}>`
    case "number":
      return `<input type="number" ${base}${req} step="any">`
    case "json":
      return `<textarea rows="3" ${base}${req} data-json="1" placeholder="${label}"></textarea>`
    default:
      return `<input type="text" ${base}${req} placeholder="${label}">`
  }
}

const fieldsOf = (inputSchema: unknown, actionId: string): string => {
  const s = (inputSchema ?? {}) as JsonSchema
  const props = s.properties ?? {}
  const required = new Set(s.required ?? [])
  const keys = Object.keys(props)
  if (keys.length === 0) return `<p class="parity-args">(no arguments)</p>`
  return keys
    .map((k) => {
      const field = controlFor(k, props[k] ?? {}, actionId, required.has(k))
      const star = required.has(k) ? ' <span class="parity-req" aria-hidden="true">*</span>' : ""
      return `<label class="parity-field">${esc(k)}${star}${field}</label>`
    })
    .join("\n")
}

export const formOf = (action: ParityAction, index: number): string => {
  const id = `${esc(action.name)}-form-${index}`
  const desc = action.description !== undefined ? `<p class="parity-desc">${esc(action.description)}</p>` : ""
  return [
    `<form class="parity-form" data-action="${esc(action.name)}" id="${id}">`,
    `<h4>${esc(action.name)}</h4>`,
    desc,
    fieldsOf(action.inputSchema, esc(action.name)),
    `<button type="submit" data-run="${esc(action.name)}">run ${esc(action.name)}</button>`,
    `</form>`,
  ].join("\n")
}
