/** Runtime values an app view may read without embedding executable code. */
export type UiDynamicValue<T> = T | { readonly state: string } | { readonly item: string }

export type UiActionParam = UiDynamicValue<string | number | boolean | null>

/**
 * Repeat a container over a list.
 *
 * The repeated unit is the element's **children**, not the element — the
 * renderer maps the list once and renders every child once per entry inside
 * that one container. So the element carrying `repeat` is a wrapper, and the
 * thing that multiplies is the single record it contains:
 *
 *     { component: "Table.Body",  repeat, children: [ Table.Row ] }   // one row per item
 *     { component: "Flex",        repeat, children: [ Card ] }        // one card per item
 *
 * Putting `repeat` on the record itself is the easy mistake and renders
 * exactly one: a `repeat` on `Table.Row` repeats the row's *cells*, so every
 * item's cells land in a single row — a whole table on one line. If the
 * element you want repeated is the element you put `repeat` on, move it up
 * one level.
 */
export type UiRepeatSpec = {
  readonly source: { readonly state: string } | { readonly item: string }
  readonly key?: string
}

/** One comparison: the value at `source`, optionally tested against `equals`. */
export interface UiCondition {
  readonly source: { readonly state: string } | { readonly item: string }
  /**
   * A literal, or a state path to compare against. The second form is what a
   * filter needs — "this row's state is the state the operator picked" is a
   * comparison between two live values, and no literal can express it.
   */
  readonly equals?: UiDynamicValue<string | number | boolean | null>
  readonly not?: boolean
}

/**
 * When a node is shown. A single comparison, or `any` of several — a filter
 * chip's "everything, or this one state" is an `any`, not a value.
 */
export type UiVisibilitySpec = UiCondition | { readonly any: readonly UiCondition[] }

export type TextVariant = "body" | "title" | "metric" | "status"
export type TextTone = "neutral" | "success" | "warning" | "danger"
