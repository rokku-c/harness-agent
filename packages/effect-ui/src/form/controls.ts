import type { FormNode } from "./types.ts"

/**
 * The control a schema field is edited with, decided from the field's own kind.
 *
 * This is a decision about the schema, not about markup: the kind of value a
 * field holds decides which control can hold it, and the password case is a
 * property of the field — `writeOnly`, a `format`, or a key naming a secret.
 * The surface renders the control; it does not choose it.
 *
 * This file used to also carry the HTML for each of those inputs. Emitting
 * markup was the html renderer's job, and the html renderer is deleted: the
 * declaration layer decides, and the one renderer draws.
 */
export const formInputType = (node: FormNode): string => {
  if (node.kind === "enum" || (node.kind === "boolean" && !node.required)) return "select"
  if (node.kind === "boolean") return "checkbox"
  if (node.kind === "number" || node.kind === "integer") return "number"
  if (node.schema.writeOnly || node.schema.format === "password" || /key|secret|password|token|credential/i.test(node.key)) return "password"
  return "text"
}
