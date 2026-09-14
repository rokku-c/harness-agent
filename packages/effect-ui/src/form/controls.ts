import type { FormNode } from "./types.ts"

export const formInputType = (node: FormNode): string => {
  if (node.kind === "enum" || (node.kind === "boolean" && !node.required)) return "select"
  if (node.kind === "boolean") return "checkbox"
  if (node.kind === "number" || node.kind === "integer") return "number"
  if (node.schema.writeOnly || node.schema.format === "password" || /key|secret|password|token|credential/i.test(node.key)) return "password"
  return "text"
}
