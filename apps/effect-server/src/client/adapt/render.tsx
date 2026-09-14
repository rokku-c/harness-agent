/**
 * One component name, turned into the React component that draws it.
 *
 * A view names a design-system export and carries that component's own props,
 * so this is not a vocabulary of ours over the library: it is three answers to
 * what a name means, and nothing else.
 *
 *   control  the component holds a live value, written back to view state
 *   press    the component runs the action the node declared
 *   display  the library's component, with its props passed through
 *
 * Which one a name is gets decided here, once per name. A name the library does
 * not have returns Unresolved, so one bad node costs the view that node and not
 * the screen.
 */

import * as React from "react"
import { useBoundProp, type ComponentRenderer, type ComponentRenderProps } from "@json-render/react"
import type { ComponentType, ReactNode } from "react"
import { attributes, content, hasChildren, propsOf, type Binding, type Props } from "./contract.ts"
import { binding, read } from "./controls.ts"
import { libraryComponent } from "./catalog.ts"
import { Unresolved } from "./unresolved.tsx"

/** The library's pressable components. Kept beside the decision that reads it. */
const PRESSABLE = new Set(["Button", "IconButton"])

/**
 * A component found by name, rendered.
 *
 * A name resolved at runtime is not a type, so `libraryComponent` returns
 * `ComponentType<never>`: `never` is the honest parameter for "we do not know
 * what this component accepts", and `Record<string, unknown>` is what its props
 * are to us. The cast is made once, here, not at each of the three shapes.
 */
const Lookup = ({ of, props, children }: { of: ComponentType<never>; props: Props; children?: ReactNode }) => {
  const Component = of as ComponentType<Record<string, unknown>>
  return <Component {...props}>{children}</Component>
}

/** The event a node declared, named as the spec names it: `onValueChange` is `valueChange`. */
const eventOf = (handler: string): string => handler.slice(2, 3).toLowerCase() + handler.slice(3)

/**
 * The value the node shows, and where a change to it goes. The value is the
 * control's state and never its content, so a control that declares children
 * keeps them exactly where a display node would.
 */
const control = (spec: Binding, of: ComponentType<never>): ComponentRenderer => (ctx) => {
  const props = propsOf(ctx)
  const [bound, setBound] = useBoundProp<unknown>(props[spec.prop], ctx.bindings?.[spec.prop])
  const changed = (next: unknown): void => {
    setBound(read(next, spec))
    ctx.emit(eventOf(spec.handler))
  }
  return <Lookup of={of} props={{ ...attributes(ctx), [spec.prop]: bound ?? props[spec.prop], [spec.handler]: changed }}>
    {hasChildren(ctx) ? content(ctx) : undefined}
  </Lookup>
}

/** A press runs the action the node declared under `press`, and draws content as anyone else. */
const press = (of: ComponentType<never>): ComponentRenderer => (ctx: ComponentRenderProps) =>
  <Lookup of={of} props={{ ...attributes(ctx), onClick: () => ctx.emit("press") }}>{content(ctx)}</Lookup>

/** Everything else: the library's own component, its props untouched. */
const display = (of: ComponentType<never>): ComponentRenderer => (ctx: ComponentRenderProps) =>
  <Lookup of={of} props={attributes(ctx)}>{content(ctx)}</Lookup>

const shapeOf = (name: string, of: ComponentType<never>): ComponentRenderer => {
  const spec = binding(name)
  if (spec !== undefined) return control(spec, of)
  return PRESSABLE.has(name) ? press(of) : display(of)
}

/**
 * One renderer per name, for the life of the page.
 *
 * This is not an optimisation. `adaptRegistry` runs on every render, because a
 * config form mutates its spec and re-renders, so a renderer built fresh each
 * time would be a component type React had not seen before — and React answers
 * a changed type by unmounting that subtree and mounting a new one, losing the
 * focus in the middle of a keystroke, resetting the scroll, discarding whatever
 * the DOM was holding. Returning the same component object is what keeps React
 * updating the tree instead of replacing it.
 */
const CACHE = new Map<string, ComponentRenderer>()

export const adaptComponent = (name: string): ComponentRenderer => {
  const cached = CACHE.get(name)
  if (cached !== undefined) return cached
  const of = libraryComponent(name)
  const renderer = of === undefined ? Unresolved : shapeOf(name, of)
  CACHE.set(name, renderer)
  return renderer
}
