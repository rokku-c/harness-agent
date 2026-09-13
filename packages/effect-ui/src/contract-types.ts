/** The name a view used, which is the name the design system exports. */
export type UiComponent = string

export interface InteractionRule {
  readonly on: "click" | "input" | "submit"
  readonly action: string
  readonly args?: Readonly<Record<string, string>>
}

export interface ContractElement {
  readonly id: string
  readonly component: UiComponent
  readonly data?: string
  readonly display?: boolean
  readonly collapsible?: boolean
  readonly children?: readonly string[]
  readonly interactive?: readonly InteractionRule[]
}

export interface ContractRules {
  readonly collapsibleIds: readonly string[]
  readonly exclusive: boolean
  readonly expandOn: "click" | "enter"
}

export interface RenderContract {
  readonly lang: "contract"
  readonly elements: readonly ContractElement[]
  readonly actions: ReadonlyArray<{ name: string; description?: string; inputSchema?: unknown }>
  readonly emptyDataRule: string
  readonly rules: ContractRules
}
