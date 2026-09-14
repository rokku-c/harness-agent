import { NAV_ROOT, type UiNodeSpec } from "@effect-agent/effect-ui"
import { decisionStrip } from "./effect-ui-decision-strip.ts"
import { decisionGate } from "./effect-ui-decisions.ts"
import { outcome } from "./effect-ui-feedback.ts"
import { failureCallout, field, press, region, row, section, stateValue, text } from "./effect-ui-nodes.ts"
import { timelineSection } from "./effect-ui-timeline.ts"

const OPEN = { source: { state: "/mantis/conversation/conversationId" } } as const

const composer: UiNodeSpec = {
  ...section("Send message", [
    row([text("Conversation", { size: "1", color: "gray" }), stateValue("/mantis/conversation/conversationId")]),
    field("Message", { component: "TextArea", bind: "/message/text" }),
    field("Wait for the reply", { component: "Switch", bind: "/message/wait", as: "checked" }),
    row([press("Send", "mantis.send", {
      conversationId: { state: "/mantis/conversation/conversationId" }, text: { state: "/message/text" },
    })]),
    row([...outcome("/mantis/send", "/mantis/send/accepted", "Message accepted")]),
  ]),
  visible: OPEN,
}

const readAgain: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  visible: { source: { state: "/message/wait" }, equals: false },
  children: [
    text("A fired turn answers as soon as it is accepted and the reply arrives later. The timeline below is read rather than streamed, so it holds what was there when it was last read.", { size: "2", color: "gray" }),
    row([press("Read the timeline again", "mantis.conversation", {
      conversationId: { state: "/mantis/conversation/conversationId" },
    }, { size: "1", variant: "soft" })]),
  ],
}

export const chatNodes: readonly UiNodeSpec[] = [
  failureCallout("/mantis/conversation/error"),
  { component: "Text", props: { value: "No conversation is open. Pick one from the list, or name one.", size: "2", color: "gray" },
    visible: { source: { state: `${NAV_ROOT}/conversationId` }, not: true } },
  decisionGate,
  decisionStrip,
  { ...region([readAgain, timelineSection]), visible: OPEN },
  composer,
]
