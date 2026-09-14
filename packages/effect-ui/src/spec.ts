import type { UiActionSpec, UiSourceSpec } from "./data-spec.ts"
import type { UiActionParam, UiRepeatSpec, UiVisibilitySpec } from "./value-spec.ts"
import type { UiScreen } from "./screen-spec.ts"

export type UiNodeField =
  | "component" | "props" | "children" | "id" | "bind" | "item" | "as" | "repeat" | "visible" | "onPress" | "params"

export type UiProps = Readonly<Record<string, unknown> & { [K in UiNodeField]?: never }>

export interface UiNode {
  readonly component: string
  readonly props?: UiProps
  readonly children?: readonly UiNode[]
  readonly id?: string
  readonly bind?: string
  readonly item?: string
  readonly as?: string
  readonly repeat?: UiRepeatSpec
  readonly visible?: UiVisibilitySpec
  readonly onPress?: string
  readonly params?: Readonly<Record<string, UiActionParam>>
}

export type UiNodeSpec = UiNode

export type UiViewLayout = "screen" | "flow"

export interface EffectUiView {
  readonly viewId: string
  readonly title?: string
  readonly layout?: UiViewLayout
  readonly state?: Readonly<Record<string, unknown>>
  readonly sources?: readonly UiSourceSpec[]
  readonly actions?: readonly UiActionSpec[]
  readonly nodes: readonly UiNode[]
  readonly screens?: readonly UiScreen[]
}
