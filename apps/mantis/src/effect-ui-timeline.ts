import { toneWhen, type UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyMessage, row, rowValue, section, stateBadge } from "./effect-ui-nodes.ts"

const present = (item: string, node: UiNodeSpec): UiNodeSpec => ({ ...node, visible: { source: { item } } })

export const toolStateBadges: readonly UiNodeSpec[] = [
  toneWhen("state", "call", "pending", "Running"),
  toneWhen("state", "ok", "ok", "Succeeded"),
  toneWhen("state", "fail", "failed", "Failed"),
]

const entryHead: UiNodeSpec = row([
  rowValue("seq", { color: "gray" }),
  stateBadge("kind"),
  present("role", { component: "Text", props: { size: "1", color: "gray" }, item: "role" }),
  present("tool", rowValue("tool")),
  ...toolStateBadges,
])

const entry: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [
    entryHead,
    present("text", { component: "Text", props: { size: "2" }, item: "text" }),
    present("detail", { component: "Text", props: { size: "1", color: "gray" }, item: "detail" }),
  ],
}

export const timelineSection: UiNodeSpec = section("Timeline", [
  emptyMessage("/mantis/conversation/entries", "This conversation has no turns yet."),
  { component: "Flex", props: { direction: "column", gap: "4" },
    repeat: { source: { state: "/mantis/conversation/entries" }, key: "seq" }, children: [entry] },
])
