export interface ConsoleRoleSpec { readonly elements: Record<string, { readonly type: string; readonly props?: Record<string, unknown> }> }
export interface ConsoleRoleNode { readonly type: string; readonly props: Record<string, unknown> }
/** Generic role lookup used by every console surface renderer. */
export const renderRole = (spec: ConsoleRoleSpec | undefined, type: string, fallback: Record<string, unknown>): ConsoleRoleNode => {
  const node = Object.values(spec?.elements ?? {}).find((element) => element.type === type)
  return { type, props: node?.props ?? fallback }
}
export const roleItems = (node: ConsoleRoleNode, key: string): Array<{ id: string; title: string }> => {
  const value = node.props[key]
  return Array.isArray(value) ? value as Array<{ id: string; title: string }> : []
}
