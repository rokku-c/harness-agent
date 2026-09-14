import type { Spec } from "@json-render/core"
import type { UiActionSpec, UiSourceSpec } from "@effect-agent/effect-ui"

export interface ScreenPayload {
  readonly id: string
  readonly title: string
  readonly parent?: string
  readonly onEnter?: string
  readonly spec: Spec & { readonly state?: Record<string, unknown> }
}

export interface EffectUiRuntimeSpec {
  readonly appId: string
  readonly title?: string
  readonly screens: readonly ScreenPayload[]
  readonly menu: boolean
  readonly actions?: readonly UiActionSpec[]
  readonly sources?: readonly UiSourceSpec[]
}
