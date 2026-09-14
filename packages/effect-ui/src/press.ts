import type { UiNodeSpec, UiProps } from "./spec.ts"
import type { UiActionParam } from "./value-spec.ts"

export const press = (
  label: string, onPress: string,
  params?: Readonly<Record<string, UiActionParam>>,
  props: UiProps = {},
): UiNodeSpec =>
  ({ component: "Button", props: { value: label, ...props }, onPress, ...(params === undefined ? {} : { params }) })
