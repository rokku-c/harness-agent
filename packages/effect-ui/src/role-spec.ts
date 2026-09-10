import type { ActionBinding, Spec, UIElement } from "@json-render/core"
import { getRole, type RoleName } from "./role-registry.ts"
import type { UiNodeSpec } from "./spec.ts"

export type RoleEvents = Record<string, ActionBinding | readonly ActionBinding[]>
export interface RoleNode { readonly role: RoleName; readonly props?: Record<string, unknown>; readonly children?: readonly RoleNode[]; readonly events?: RoleEvents }
export const viewRole: Record<UiNodeSpec["kind"], RoleName> = { text: "Text", stack: "Stack", button: "Button", formField: "Input", list: "Stack" }
export const roleElement = (role: string, props: Record<string, unknown> = {}, children?: readonly string[], events?: RoleEvents): UIElement => {
  const definition = getRole(role)
  for (const event of Object.keys(events ?? {})) if (!definition.radix.events?.includes(event)) throw new Error(`Unsupported UI event: ${role}.${event}`)
  return { type: role, props, ...(children === undefined ? {} : { children: [...children] }), ...(events === undefined ? {} : { on: events as Record<string, ActionBinding | ActionBinding[]> }) }
}
export const roleDocument = (children: readonly RoleNode[]): Spec => {
  const elements: Record<string, UIElement> = {}
  const lower = (node: RoleNode, path: readonly number[]): string => { const id = path.join("."), childIds = (node.children ?? []).map((child, index) => lower(child, [...path, index])); elements[id] = roleElement(node.role, node.props, childIds, node.events); return id }
  const roots = children.map((child, index) => lower(child, [index])); elements.root = roleElement("Stack", { direction: "vertical" }, roots); return { root: "root", elements }
}
