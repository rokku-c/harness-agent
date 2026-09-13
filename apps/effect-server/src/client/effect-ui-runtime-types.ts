import type { Spec } from "@json-render/core"
import type { UiActionSpec, UiSourceSpec } from "@effect-agent/effect-ui"

/**
 * One screen as the host ships it: what it is called, and the spec to render for
 * it. Lowered per screen rather than as one tree, because a spec's element ids
 * are a flat namespace — two screens whose first node has no id of its own would
 * both be `"0"`.
 */
export interface ScreenPayload {
  readonly id: string
  readonly title: string
  /** The screen the way back leads to; absent means the first one. */
  readonly parent?: string
  readonly spec: Spec & { readonly state?: Record<string, unknown> }
}

/** Everything the mounted view needs that is not the view itself. */
export interface EffectUiRuntimeSpec {
  /** The app this panel is showing — what a press that opens a screen navigates within. */
  readonly appId: string
  /** Every screen, the one the app starts on first. */
  readonly screens: readonly ScreenPayload[]
  /**
   * Whether the screens were read off the layout rather than declared by the
   * view. A declared screen has a control that opens it somewhere in the view;
   * a read one has nothing leading to it, so the host has to offer it.
   */
  readonly menu: boolean
  readonly actions?: readonly UiActionSpec[]
  readonly sources?: readonly UiSourceSpec[]
}
