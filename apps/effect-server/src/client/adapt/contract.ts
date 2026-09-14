import type { ComponentRenderProps } from "@json-render/react"
import type { ReactNode } from "react"

export type Props = Record<string, unknown>

export const CONTENT = "value"

export const propsOf = (ctx: ComponentRenderProps): Props => (ctx.element.props ?? {}) as Props

export const hasChildren = (ctx: ComponentRenderProps): boolean => (ctx.element.children?.length ?? 0) > 0

export const without = (props: Props, key: string): Props =>
  Object.fromEntries(Object.entries(props).filter(([name]) => name !== key))

export const content = (ctx: ComponentRenderProps): ReactNode =>
  hasChildren(ctx) ? ctx.children : propsOf(ctx).value as ReactNode

export const attributes = (ctx: ComponentRenderProps): Props =>
  hasChildren(ctx) ? propsOf(ctx) : without(propsOf(ctx), CONTENT)

export interface Binding {
  readonly prop: string
  readonly handler: string
  readonly dom: boolean
}
