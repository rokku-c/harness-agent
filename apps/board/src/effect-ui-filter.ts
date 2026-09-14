import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { entry } from "./effect-ui-fields.ts"
import { stateOptions } from "./effect-ui-states.ts"

const chip = (value: string, label: string): UiNodeSpec =>
  ({ component: "SegmentedControl.Item", props: { value },
    children: [{ component: "Text", props: { value: label } }] })

const stateFilter: UiNodeSpec = {
  component: "SegmentedControl.Root",
  props: { size: "2" },
  bind: "/filter",
  children: [chip("all", "All"), ...stateOptions.map((option) => chip(option.value, option.label))],
}

const textFilter = entry("Exact title or id", "/query")

export const boardFilter: UiNodeSpec = {
  component: "Flex",
  props: { gap: "5", wrap: "wrap", align: "start" },
  children: [stateFilter, textFilter],
}

export const matchesFilter: UiNodeSpec["visible"] = {
  any: [
    { source: { state: "/filter" }, equals: "all" },
    { source: { item: "state" }, equals: { state: "/filter" } },
  ],
}

export const matchesQuery: UiNodeSpec["visible"] = {
  any: [
    { source: { state: "/query" }, not: true },
    { source: { item: "title" }, equals: { state: "/query" } },
    { source: { item: "id" }, equals: { state: "/query" } },
  ],
}

export const hidingSome: UiNodeSpec["visible"] = {
  any: [
    { source: { state: "/filter" }, equals: "all", not: true },
    { source: { state: "/query" } },
  ],
}
