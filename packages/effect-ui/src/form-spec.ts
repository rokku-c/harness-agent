import type { Spec, UIElement } from "@json-render/core"
import { createFormControls } from "./form/controls.ts"
import { createFormModel } from "./form/model.ts"
import type { FormNode, JsonSchema } from "./form/types.ts"

/** Declarative form projection; field paths make nested object state lossless. */
export const formToJsonSpec = (appId: string, schema?: JsonSchema, value?: Readonly<Record<string, unknown>>): Spec => {
  const elements: Record<string, UIElement> = {}, controls = createFormControls(), form = createFormModel().create(appId, schema, value)
  const lower = (node: FormNode, path: readonly string[]): string => {
    const fieldPath = path.join(".")
    if (node.kind === "object" || node.kind === "array") {
      const children = node.kind === "array" ? node.rows.map((child, index) => lower(child, [...path, String(index)])) : node.fields.map(child => lower(child, [...path, child.key]))
      if (node.kind === "array") children.forEach(child => { const element = elements[child]; element.props = { ...element.props, arrayRow: true } })
      elements[node.id] = { type: "Stack", props: { direction: "vertical", role: node.kind, label: node.key, fieldPath, itemSchema: node.kind === "array" ? node.schema.items : undefined }, children }
    } else elements[node.id] = { type: "Input", props: { label: node.key, value: String(node.value ?? ""), inputType: controls.inputType(node), fieldKind: node.kind, fieldPath, options: node.kind === "enum" ? node.schema.enum : node.kind === "boolean" ? [true, false] : undefined, rawValue: node.value, required: node.required, unset: node.value === undefined, checked: node.value === true, readOnly: node.locked } }
    return node.id
  }
  const fields = form.root.fields.map(field => lower(field, [field.key]))
  elements["cfg.title"] = { type: "Text", props: { value: `${appId} · config` } }
  for (const strategy of ["apply", "restart"]) elements[`cfg.${strategy}`] = { type: "Button", props: { label: strategy === "apply" ? "Save and Apply" : "Save for Restart", strategy } }
  elements.root = { type: "Stack", props: { direction: "vertical" }, children: ["cfg.title", ...fields, "cfg.apply", "cfg.restart"] }
  return { root: "root", elements }
}
