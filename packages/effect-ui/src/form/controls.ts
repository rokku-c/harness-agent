import type { FormNode } from "./types.ts"

export function createFormControls() {
  const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g,
    char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
  const inputType = (node: FormNode): string => {
    if (node.kind === "enum" || (node.kind === "boolean" && !node.required)) return "select"
    if (node.kind === "boolean") return "checkbox"
    if (node.kind === "number" || node.kind === "integer") return "number"
    if (node.schema.writeOnly || node.schema.format === "password" || /key|secret|password|token|credential/i.test(node.key)) return "password"
    return "text"
  }
  const input = (node: FormNode): string => {
    const type = inputType(node), value = node.value
    const attrs = `id="${node.id}" data-field="${esc(node.key)}" data-node="${node.id}" name="${node.id}"`
    if (type === "select") {
      const options = node.kind === "enum" ? node.schema.enum! : [true, false]
      const blank = `<option value=""${value === undefined ? " selected" : ""}>${node.required ? "请选择" : "未设置（使用 schema 默认）"}</option>`
      return `<select ${attrs}>${blank}${options.map((option, i) =>
        `<option value="${i}"${Object.is(option, value) ? " selected" : ""}>${esc(option)}</option>`).join("")}</select>`
    }
    if (type === "checkbox") return `<input ${attrs} type="checkbox"${value === true ? " checked" : ""}>`
    const step = type === "number" ? ` step="${node.kind === "integer" ? "1" : "any"}"` : ""
    return `<input ${attrs} type="${type}" value="${esc(value)}"${step}${type === "password" ? ' autocomplete="new-password"' : ""}>`
  }
  return { esc, inputType, input }
}
export type FormControls = ReturnType<typeof createFormControls>
