import * as React from "react"
import { useBoundProp, type ComponentRenderer, type ComponentRenderProps } from "@json-render/react"
import type { ComponentType, ReactNode } from "react"
import { attributes, content, hasChildren, propsOf, type Binding, type Props } from "./contract.ts"
import { binding, read } from "./controls.ts"
import { libraryComponent } from "./catalog.ts"
import { Unresolved } from "./unresolved.tsx"

const PRESSABLE = new Set(["Button", "IconButton"])

const Lookup = ({ of, props, children }: { of: ComponentType<never>; props: Props; children?: ReactNode }) => {
  const Component = of as ComponentType<Record<string, unknown>>
  return <Component {...props}>{children}</Component>
}

const eventOf = (handler: string): string => handler.slice(2, 3).toLowerCase() + handler.slice(3)

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

const press = (of: ComponentType<never>): ComponentRenderer => (ctx: ComponentRenderProps) =>
  <Lookup of={of} props={{ ...attributes(ctx), onClick: () => ctx.emit("press") }}>{content(ctx)}</Lookup>

const display = (of: ComponentType<never>): ComponentRenderer => (ctx: ComponentRenderProps) =>
  <Lookup of={of} props={attributes(ctx)}>{content(ctx)}</Lookup>

const shapeOf = (name: string, of: ComponentType<never>): ComponentRenderer => {
  const spec = binding(name)
  if (spec !== undefined) return control(spec, of)
  return PRESSABLE.has(name) ? press(of) : display(of)
}

const CACHE = new Map<string, ComponentRenderer>()

export const adaptComponent = (name: string): ComponentRenderer => {
  const cached = CACHE.get(name)
  if (cached !== undefined) return cached
  const of = libraryComponent(name)
  const renderer = of === undefined ? Unresolved : shapeOf(name, of)
  CACHE.set(name, renderer)
  return renderer
}
