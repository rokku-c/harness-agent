/**
 * Declarative UI contract.
 *
 * A node names a @radix-ui/themes component and carries that component's own
 * props. We do not define a component vocabulary — the design system does, and
 * `component` is a path into its exports: `"Card"`, `"Badge"`, `"Table.Root"`.
 * Adding a component to a view is naming it; there is no registry to extend.
 *
 * What this file adds is what a *live* view needs and a static one does not:
 * where a value comes from, how a list repeats, when a node is shown, which
 * declared action a press runs, and which screen that press enters. That is the
 * whole of our layer — one conversion, no vocabulary of our own.
 */

import type { UiActionSpec, UiSourceSpec } from "./data-spec.ts"
import type { UiActionParam, UiRepeatSpec, UiVisibilitySpec } from "./value-spec.ts"

export interface UiNode {
  /** A `@radix-ui/themes` export, dotted for a subcomponent: `"Card"`, `"Table.Row"`. */
  readonly component: string
  /** That component's own props, passed through. */
  readonly props?: Readonly<Record<string, unknown>>
  readonly children?: readonly UiNode[]
  readonly id?: string
  /** Live value read from view state, written to the prop named by `as`. */
  readonly bind?: string
  /** Live value read from the current repeat item, written to the prop named by `as`. */
  readonly item?: string
  /**
   * Which prop a bound or item value lands in. Defaults to `value`, which the
   * conversion layer renders where that component keeps its content — children
   * for `Text` and `Button`, the control's own value for a field.
   */
  readonly as?: string
  readonly repeat?: UiRepeatSpec
  readonly visible?: UiVisibilitySpec
  /** A declared action, run when the component's primary event fires. */
  readonly onPress?: string
  readonly params?: Readonly<Record<string, UiActionParam>>
}

/** One node. Named for the union it used to be; a view is a list of these. */
export type UiNodeSpec = UiNode

/**
 * One screen a view can be entered at: Android's Activity, iOS's view
 * controller.
 *
 * A view is a tool surface, and a tool has functions — a fleet and the agent you
 * picked out of it, a board and the task you opened. `nodes` is the screen the
 * app starts on; these are the ones you enter from it, by a declared action that
 * says `opens` (see data-spec.ts). A screen is the same node vocabulary as any
 * other: nothing here is a second way to write a view.
 */
export interface UiScreen {
  readonly id: string
  readonly title: string
  /**
   * The screen a back control returns to. Absent means the one the app starts
   * on, so a screen entered straight from there says nothing. It is declared for
   * the chain — a log opened from an agent opened from a fleet — and its other
   * use is a link that arrived cold: the host rebuilds the stack from it.
   */
  readonly parent?: string
  readonly nodes: readonly UiNode[]
}

/**
 * What the view is shaped like. A view is a tool surface and so is a screen by
 * default: it fills the area the shell gives it, and says for itself which part
 * of itself scrolls (see `region` in nodes.ts). `flow` is the opt-out, for the
 * rare view that really is a document — one that should be exactly as tall as
 * its content and carry the page's scrollbar. See `viewToJsonSpec` for the one
 * place this is read.
 */
export type UiViewLayout = "screen" | "flow"

/** One schema-exportable app view with optional state, sources and actions. */
export interface EffectUiView {
  readonly viewId: string
  readonly title?: string
  readonly layout?: UiViewLayout
  readonly state?: Readonly<Record<string, unknown>>
  readonly sources?: readonly UiSourceSpec[]
  readonly actions?: readonly UiActionSpec[]
  /** The screen the app starts on. */
  readonly nodes: readonly UiNode[]
  /**
   * The other screens. A view that declares none is offered one screen per
   * function where that can be read off `nodes` safely, and one screen where it
   * cannot — see `screensOf`, which is the single answer to "how many screens
   * does this view have".
   */
  readonly screens?: readonly UiScreen[]
}
