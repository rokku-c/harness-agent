export type UiDynamicValue<T> = T | { readonly state: string } | { readonly item: string }

export type UiActionParam = UiDynamicValue<string | number | boolean | null>

export type UiRepeatSpec = {
  readonly source: { readonly state: string } | { readonly item: string }
  readonly key?: string
}

export interface UiCondition {
  readonly source: { readonly state: string } | { readonly item: string }
  readonly equals?: UiDynamicValue<string | number | boolean | null>
  readonly not?: boolean
}

export type UiVisibilitySpec = UiCondition | { readonly any: readonly UiCondition[] }

export type TextVariant = "body" | "title" | "metric" | "status"
export type TextTone = "neutral" | "success" | "warning" | "danger"
