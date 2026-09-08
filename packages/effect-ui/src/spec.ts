/**
 * effect-ui spec — declarative UI contract types.
 *
 * An effect app declares ONLY this contract (an EffectUiView of closed-union
 * UiNodeSpec nodes). It carries no renderer/component implementation details,
 * so renderers can be swapped behind the UiRenderer seam (see renderer.ts).
 */

/** A single block of text. When `bind` is set, the projected value reads (and writes) render-time state instead of `text`. */
export interface TextNode {
  readonly kind: "text"
  readonly id?: string
  /** JSON pointer into render-time state; the projected `value` becomes `{ $bindState: bind }`. */
  readonly bind?: string
  readonly text: string
}

/** A container that stacks children horizontally ("row") or vertically. */
export interface StackNode {
  readonly kind: "stack"
  readonly id?: string
  readonly children: readonly UiNodeSpec[]
  readonly gap?: number
  readonly direction?: "horizontal" | "vertical"
}

/** An interactive button with an optional press action name. */
export interface ButtonNode {
  readonly kind: "button"
  readonly id?: string
  /** JSON pointer into render-time state; when set the projected label two-way binds state. */
  readonly bind?: string
  readonly label: string
  readonly onPress?: string
}

/** A labelled form input. */
export interface FormFieldNode {
  readonly kind: "formField"
  readonly id?: string
  readonly label: string
  /** JSON pointer into render-time state; when set the projected `value` two-way binds state. */
  readonly bind?: string
  readonly value?: string
  readonly placeholder?: string
}

/** An ordered list of literal items. */
export interface ListNode {
  readonly kind: "list"
  readonly id?: string
  readonly items: readonly string[]
}

/** Closed union of declarative node kinds an app view can contain. */
export type UiNodeSpec = TextNode | StackNode | ButtonNode | FormFieldNode | ListNode

/** A schema-exportable UI contract for one app view. */
export interface EffectUiView {
  readonly viewId: string
  readonly title?: string
  readonly nodes: readonly UiNodeSpec[]
}
