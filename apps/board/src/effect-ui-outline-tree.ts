import { itemRows, row, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"

const LEVELS = 3

const doneMark: UiNodeSpec = { ...toneBadge("ok", "Done"), visible: { source: { item: "done" } } }

const under = (depth: number): UiNodeSpec => depth === 0
  ? { component: "Text", props: { value: "Has nodes of its own, which are not drawn here.",
      size: "1", color: "gray" }, visible: itemRows("children") }
  : {
      component: "Flex",
      props: { direction: "column", gap: "2", ml: "5" },
      repeat: { source: { item: "children" }, key: "nodeId" },
      visible: itemRows("children"),
      children: [node(depth - 1)],
    }

const node = (depth: number): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [
    row([doneMark, { component: "Text", props: { size: "2" }, item: "text" }]),
    under(depth),
  ],
})

export const outlineTree: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  repeat: { source: { state: "/outline/read/nodes" }, key: "nodeId" },
  children: [node(LEVELS - 1)],
}
