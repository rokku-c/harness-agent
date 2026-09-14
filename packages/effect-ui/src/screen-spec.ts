import type { UiNode } from "./spec.ts"

export interface UiScreen {
  readonly id: string
  readonly title: string
  readonly parent?: string
  readonly onEnter?: string
  readonly nodes: readonly UiNode[]
}
