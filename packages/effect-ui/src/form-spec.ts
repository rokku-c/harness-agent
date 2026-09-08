import type { Spec, UIElement } from "@json-render/core"
import { createFormControls } from "./form/controls.ts"
import { createFormModel } from "./form/model.ts"
import type { FormNode, JsonSchema } from "./form/types.ts"

/** The declarative companion to the no-build form; nested blocks remain structured. */
export const formToJsonSpec = (appId: string, schema?: JsonSchema, value?: Readonly<Record<string, unknown>>): Spec => {
  const elements: Record<string, UIElement> = {}
  const controls = createFormControls()
  const form = createFormModel().create(appId, schema, value)
  const lower = (node: FormNode): string => {
    if (node.kind === "object" || node.kind === "array") {
      elements[node.id] = { type: "Stack", props: { direction: "vertical", role: node.kind, label: node.key,
        enabled: node.enabled, discriminator: node.discriminator }, children: [...node.fields, ...node.rows].map(lower) }
    } else elements[node.id] = { type: "Input", props: { label: node.key, value: String(node.value ?? ""),
      inputType: controls.inputType(node), options: node.schema.enum, required: node.required,
      unset: node.value === undefined, checked: node.value === true, readOnly: node.locked } }
    return node.id
  }
  const fields = form.root.fields.map(lower)
  elements["cfg.title"] = { type: "Text", props: { value: `${appId} · config` } }
  for (const strategy of ["apply", "restart"]) elements[`cfg.${strategy}`] = {
    type: "Button", props: { label: strategy === "apply" ? "保存并应用" : "保存待重启", strategy },
  }
  elements.root = { type: "Stack", props: { direction: "vertical" }, children: ["cfg.title", ...fields, "cfg.apply", "cfg.restart"] }
  return { root: "root", elements }
}
