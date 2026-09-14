import { row, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"

const has = (field: string): UiNodeSpec["visible"] => ({ source: { item: field } })

const labelled = (label: string, field: string, value: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { gap: "1", align: "center" }, visible: has(field),
    children: [{ component: "Text", props: { value: label, size: "1", color: "gray" } }, value] })

const toned = (field: string, badge: UiNodeSpec, value: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { gap: "2", align: "center" }, visible: has(field), children: [badge, value] })

export const taskSignals: UiNodeSpec = row([
  labelled("in", "parentTitle", { component: "Text", props: { size: "1" }, item: "parentTitle" }),
  toned("waits", { ...toneBadge("pending", "Waiting"), visible: has("waits") }, { component: "Text", props: { size: "1" }, item: "waits" }),
  toned("failure", { ...toneBadge("failed", "Failed"), visible: has("failure") }, { component: "Code", props: { size: "1" }, item: "failure" }),
])
