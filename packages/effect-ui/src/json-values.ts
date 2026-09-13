import type { UIElement } from "@json-render/core"
import type { UiActionParam, UiCondition, UiDynamicValue, UiRepeatSpec, UiVisibilitySpec } from "./value-spec.ts"

const source = (value: { readonly state: string } | { readonly item: string }): { $state: string } | { $item: string } =>
  "state" in value ? { $state: value.state } : { $item: value.item }

export const jsonDynamic = <T>(value: UiDynamicValue<T>): unknown =>
  typeof value === "object" && value !== null ? source(value as { state: string } | { item: string }) : value

export const jsonBind = (path: string): unknown => ({ $bindState: path })

const isItem = (value: UiActionParam): value is { readonly item: string } =>
  typeof value === "object" && value !== null && "item" in value

/**
 * An action param reads the *value* of an item field, and json-render spells
 * that differently from a prop: in a prop `$item` is the field's value, but in
 * an action param `$item` is a state *path* — the value form there is
 * `$bindItem`, which resolves the path the repeat scope is standing on. Both
 * of our spellings mean "this item's field", so the difference stays here.
 */
export const actionParams = (params: Readonly<Record<string, UiActionParam>> | undefined): Record<string, unknown> | undefined =>
  params === undefined ? undefined : Object.fromEntries(Object.entries(params).map(([key, value]) =>
    [key, isItem(value) ? { $bindItem: value.item } : jsonDynamic(value)]))

export const jsonRepeat = (repeat: UiRepeatSpec | undefined): UIElement["repeat"] | undefined =>
  repeat === undefined ? undefined : { statePath: "state" in repeat.source ? repeat.source.state : { $item: repeat.source.item }, ...(repeat.key === undefined ? {} : { key: repeat.key }) }

const condition = (spec: UiCondition): Record<string, unknown> =>
  ({ ...source(spec.source), ...(spec.equals === undefined ? {} : { eq: jsonDynamic(spec.equals) }), ...(spec.not ? { not: true } : {}) })

export const jsonVisible = (visible: UiVisibilitySpec | undefined): UIElement["visible"] | undefined => {
  if (visible === undefined) return undefined
  return ("any" in visible ? { $or: visible.any.map(condition) } : condition(visible)) as UIElement["visible"]
}
