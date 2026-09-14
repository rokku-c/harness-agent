import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { heading, press, row, text } from "./effect-ui-nodes.ts"

export const mantisHeader: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [
    heading("Mantis", { size: "4" }),
    text("Human-agent conversations, the decisions holding a call up, and the records this host holds.", { size: "2", color: "gray" }),
  ],
}

export const mantisDoors: UiNodeSpec = row([
  press("New conversation", "mantis.newConversation", undefined, { variant: "solid", size: "2" }),
  press("Records", "mantis.openRecords", undefined, { variant: "soft", size: "2" }),
  press("Events", "mantis.openEvents", undefined, { variant: "soft", size: "2" }),
])
