/**
 * What the conversion layer is, in one file.
 *
 * A view is a tree of component names and props; the design system is a set of
 * React components. This is the whole of what sits between them, and it is one
 * idea:
 *
 *   A node's content arrives as the `value` prop.
 *
 * A JSON element has no children of its own — the id graph keeps them outside
 * the props — so `{ component: "Heading", props: { value: "Fleet" } }` means
 * `<Heading>Fleet</Heading>`, and every other prop is an attribute of the
 * component. A node that declares real children instead keeps the prop for
 * whatever the component means by it (`Select.Item`'s own value), so declared
 * children win wherever they exist.
 *
 * `as` is not a second way to say the same thing. It names a prop the component
 * already owns (`as: "src"` on an `Avatar`), so a value that lands there is an
 * ordinary attribute and is passed through with the rest.
 *
 * Three shapes follow. A *control* holds a live value that writes back to view
 * state. A *press* runs the action the node declared. Everything else is
 * *display*. Which shape a component is, is decided once per name — in
 * registry.ts — and never again while it renders.
 */

import type { ComponentRenderProps } from "@json-render/react"
import type { ReactNode } from "react"

/** A node's props, as the spec declared them. */
export type Props = Record<string, unknown>

/** Where a node's content arrives when the node declares no children. */
export const CONTENT = "value"

export const propsOf = (ctx: ComponentRenderProps): Props => (ctx.element.props ?? {}) as Props

export const hasChildren = (ctx: ComponentRenderProps): boolean => (ctx.element.children?.length ?? 0) > 0

/** Every prop, less one, without mutating what the spec handed us. */
export const without = (props: Props, key: string): Props =>
  Object.fromEntries(Object.entries(props).filter(([name]) => name !== key))

/** The node's content: what it declared as children, else the content prop. */
export const content = (ctx: ComponentRenderProps): ReactNode =>
  hasChildren(ctx) ? ctx.children : propsOf(ctx).value as ReactNode

/**
 * Its attributes: the props, minus the content prop when that prop *is* the
 * content. Without the exception a heading would be handed `value="Fleet"` as
 * well as `Fleet` as its child, and React would warn about a stray attribute on
 * a DOM node. With it, `as` still works: nothing is dropped for a node that put
 * its value on a prop the component owns.
 */
export const attributes = (ctx: ComponentRenderProps): Props =>
  hasChildren(ctx) ? propsOf(ctx) : without(propsOf(ctx), CONTENT)

/**
 * A component that holds a live value, described by the three things that
 * differ between such components in the design system. `handler` is derived
 * from `prop` rather than written beside it, so the two cannot disagree.
 */
export interface Binding {
  /** The prop the value is read from and written back to. */
  readonly prop: string
  /** The prop that hears it change, e.g. `onValueChange`. */
  readonly handler: string
  /**
   * Whether that handler reports the DOM event its own input raised rather than
   * the value. A text field does; everything else hands over the value.
   */
  readonly dom: boolean
}
