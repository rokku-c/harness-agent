/**
 * A press: the one control that runs a named behaviour.
 *
 * An action is a name — `deck.close`, `mantis.send` — and a press is what runs
 * it, carrying the values that action reads off the row or off the page. The
 * values are the press's own: the same action pressed from two places is two
 * presses with two sets of values, and an action with a `url` declares where each
 * of its parameters comes from only when a press does not supply it.
 */

import type { UiNodeSpec } from "./spec.ts"
import type { UiActionParam } from "./value-spec.ts"

export const press = (
  label: string, onPress: string,
  params?: Readonly<Record<string, UiActionParam>>,
  props: Readonly<Record<string, unknown>> = {},
): UiNodeSpec =>
  ({ component: "Button", props: { value: label, ...props }, onPress, ...(params === undefined ? {} : { params }) })
