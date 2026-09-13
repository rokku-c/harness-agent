/**
 * Rendering one node with the design system's component.
 *
 * Three cases, and together they are the whole of our conversion: a control
 * (`TextField`, `Select`, `Switch`) keeps a value that writes back to view
 * state, a pressable (`Button`, `IconButton`) runs a declared action, and
 * everything else is the library's component with its props passed through.
 *
 * `value` is the one name we add. A JSON element cannot hold children, so a
 * node's content arrives as the `value` prop; each case below puts it where
 * that component keeps its content. `as` moves it when a component wants it
 * somewhere else (`as: "src"` on an `Avatar`, say).
 *
 * That convention only holds for a node that declares no children. A component
 * whose own `value` is part of its contract — `Tabs.Trigger`, `Select.Item`,
 * `Tabs.Content` — declares its content as children and must keep the prop, so
 * declared children win and `value` becomes content only when nothing else can.
 */

import * as React from "react"
import { Callout } from "@radix-ui/themes"
import { useBoundProp, type ComponentRenderProps } from "@json-render/react"
import { resolveComponent } from "./radix-resolve.ts"
import { Preview } from "./radix-preview.tsx"

type Props = Record<string, unknown>

const propsOf = (ctx: ComponentRenderProps): Props => (ctx.element.props ?? {}) as Props
const hasChildren = (ctx: ComponentRenderProps): boolean => (ctx.element.children?.length ?? 0) > 0
const drop = (props: Props, key: string): Props => Object.fromEntries(Object.entries(props).filter(([name]) => name !== key))

/** Content is declared children, else the `value` prop — which then stops being one. */
const content = (ctx: ComponentRenderProps): React.ReactNode =>
  hasChildren(ctx) ? ctx.children : propsOf(ctx).value as React.ReactNode
const attributes = (ctx: ComponentRenderProps): Props => hasChildren(ctx) ? propsOf(ctx) : drop(propsOf(ctx), "value")

/**
 * Components whose `value` is their own state rather than their content. The
 * names are the library's own: a control is the export that holds the value,
 * which for a compound component is its `.Root`.
 */
const CONTROLS: Record<string, { readonly prop: string; readonly event: string }> = {
  "TextField.Root": { prop: "value", event: "change" },
  TextArea: { prop: "value", event: "change" },
  "Select.Root": { prop: "value", event: "valueChange" },
  "SegmentedControl.Root": { prop: "value", event: "valueChange" },
  "RadioGroup.Root": { prop: "value", event: "valueChange" },
  Switch: { prop: "checked", event: "checkedChange" },
  Checkbox: { prop: "checked", event: "checkedChange" },
  Slider: { prop: "value", event: "valueChange" },
}

const PRESSABLE = new Set(["Button", "IconButton"])

/** An `onChange`-shaped handler reads the control; the others hand over a value. */
const read = (next: unknown, prop: string): unknown => {
  const target = (next as { target?: { value?: unknown; checked?: unknown } } | null)?.target
  if (target === undefined || target === null) return next
  return prop === "checked" ? target.checked : target.value
}

const Unresolved = ({ name }: { name: string }) =>
  <Callout.Root color="red" size="1"><Callout.Text>Unknown component: {name}</Callout.Text></Callout.Root>

const Control = ({ ctx, spec }: { ctx: ComponentRenderProps; spec: { prop: string; event: string } }) => {
  const Component = resolveComponent(ctx.element.type)
  if (Component === undefined) return <Unresolved name={ctx.element.type} />
  const props = propsOf(ctx)
  const [bound, setBound] = useBoundProp<unknown>(props[spec.prop], ctx.bindings?.[spec.prop])
  const handler = "on" + spec.event[0]!.toUpperCase() + spec.event.slice(1)
  const change = (next: unknown) => { setBound(read(next, spec.prop)); ctx.emit(spec.event) }
  // A control's `value` is its state, never its content, so it is not moved
  // here: a control that declares children (`Select.Root`) keeps them.
  const live = { ...props, [spec.prop]: bound ?? props[spec.prop], [handler]: change }
  return <Component {...live}>{hasChildren(ctx) ? ctx.children : undefined}</Component>
}

const Pressable = ({ ctx }: { ctx: ComponentRenderProps }) => {
  const Component = resolveComponent(ctx.element.type)
  if (Component === undefined) return <Unresolved name={ctx.element.type} />
  return <Component {...attributes(ctx)} onClick={() => ctx.emit("press")}>{content(ctx)}</Component>
}

const Display = ({ ctx }: { ctx: ComponentRenderProps }) => {
  const Component = resolveComponent(ctx.element.type)
  if (Component === undefined) return <Unresolved name={ctx.element.type} />
  return <Component {...attributes(ctx)}>{content(ctx)}</Component>
}

export const RadixRenderer = (ctx: ComponentRenderProps) => {
  const name = ctx.element.type
  if (name === "Preview") return <Preview ctx={ctx} />
  const control = CONTROLS[name]
  if (control !== undefined) return <Control ctx={ctx} spec={control} />
  if (PRESSABLE.has(name)) return <Pressable ctx={ctx} />
  return <Display ctx={ctx} />
}
