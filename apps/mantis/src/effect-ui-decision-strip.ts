import { toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"
import { row, rowValue } from "./effect-ui-nodes.ts"
import { verdictPresses } from "./effect-ui-decisions.ts"

const stripRow: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  visible: { source: { item: "session" }, equals: { state: "/mantis/conversation/conversationId" } },
  children: [
    row([
      toneBadge("pending", "Waiting decision"),
      rowValue("tool"),
      rowValue("callId", { color: "gray" }),
    ]),
    verdictPresses,
  ],
}

export const decisionStrip: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  repeat: { source: { state: "/mantis/state/pending" }, key: "callId" },
  children: [stripRow],
}
