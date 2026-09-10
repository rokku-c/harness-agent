import type { Spec, UIElement } from "@json-render/core"
import { getRole, type RoleName } from "./role-registry.ts"
import type { UiNodeSpec } from "./spec.ts"

export interface RoleNode { readonly role: RoleName; readonly props?: Record<string, unknown>; readonly children?: readonly RoleNode[] }
export const viewRole: Record<UiNodeSpec["kind"], RoleName> = { text: "Text", stack: "Stack", button: "Button", formField: "Input", list: "Stack" }
export const roleElement = (role: string, props: Record<string, unknown> = {}, children?: readonly string[]): UIElement => { getRole(role); return { type: role, props, ...(children === undefined ? {} : { children: [...children] }) } }
export const roleDocument = (children: readonly RoleNode[]): Spec => {
  const elements: Record<string, UIElement> = {}
  const lower = (node: RoleNode, path: readonly number[]): string => { const id = path.join("."), childIds = (node.children ?? []).map((child, index) => lower(child, [...path, index])); elements[id] = roleElement(node.role, node.props, childIds); return id }
  const roots = children.map((child, index) => lower(child, [index])); elements.root = roleElement("Stack", { direction: "vertical" }, roots); return { root: "root", elements }
}
