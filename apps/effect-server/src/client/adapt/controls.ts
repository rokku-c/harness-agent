import type { Binding } from "./contract.ts"

const CONTROLS = new Map<string, string>([
  ["TextField.Root", "value"],
  ["TextArea", "value"],
  ["Select.Root", "value"],
  ["SegmentedControl.Root", "value"],
  ["RadioGroup.Root", "value"],
  ["Slider", "value"],
  ["Switch", "checked"],
  ["Checkbox", "checked"],
])

const DOM_EVENT = new Set(["TextField.Root", "TextArea"])

const capitalised = (prop: string): string => prop.charAt(0).toUpperCase() + prop.slice(1)

export const binding = (name: string): Binding | undefined => {
  const prop = CONTROLS.get(name)
  if (prop === undefined) return undefined
  const dom = DOM_EVENT.has(name)
  return { prop, handler: dom ? "onChange" : `on${capitalised(prop)}Change`, dom }
}

export const read = (next: unknown, binding: Binding): unknown => {
  if (!binding.dom) return next
  const target = (next as { target?: { value?: unknown } } | undefined)?.target
  return target === undefined ? next : target.value
}
