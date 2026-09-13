/**
 * The conversation surface: the composer the page exists for, the timeline it
 * feeds, and the conversations whose timelines can be read. The timeline sits
 * above the list that fills it, so a press near the bottom of the page does not
 * push its own result past the fold.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { row } from "@effect-agent/effect-ui"
import { acceptedBadge, errorBadge, refusalBadge } from "./effect-ui-feedback.ts"
import { sharedSourceStates } from "./effect-ui-list.ts"
import { cell, cellOf, codeCell, field, section, stateBadge, table, text } from "./effect-ui-nodes.ts"

/** One turn of a transcript: a card per entry, since turns read as turns, not rows. */
const turnCard: UiNodeSpec = {
  component: "Card",
  props: { size: "1", variant: "surface" },
  children: [
    { component: "Flex", props: { justify: "between", align: "center", gap: "2" }, children: [
      stateBadge("kind"),
      { component: "Text", props: { size: "1", color: "gray" }, item: "role" },
    ] },
    { component: "Text", props: { size: "2", weight: "medium" }, item: "tool" },
    { component: "Text", item: "text" },
    { component: "Text", props: { size: "1", color: "gray" }, item: "detail" },
  ],
}

/** The app's primary task, first under the header, with its outcome under the button. */
const composer: UiNodeSpec = section("Send message", [
  field("Conversation id", { component: "TextField.Root", bind: "/message/conversationId" }),
  field("Message", { component: "TextArea", bind: "/message/text" }),
  row([{ component: "Button", props: { value: "Send" }, onPress: "mantis.send",
    params: { conversationId: { state: "/message/conversationId" }, text: { state: "/message/text" } } }]),
  row([
    acceptedBadge("/mantis/send/accepted", "Message accepted"),
    refusalBadge("/mantis/send"),
    errorBadge("/mantis/send"),
  ]),
])

const timeline: UiNodeSpec = section("Conversation timeline", [
  // whose timeline this is: an operator who loaded one from the list below has
  // to see which row it came from
  { component: "Flex", props: { gap: "2", align: "center" },
    visible: { source: { state: "/mantis/conversation/conversationId" } },
    children: [text("Conversation", { size: "1", color: "gray" }), { component: "Code", bind: "/mantis/conversation/conversationId" }] },
  { component: "Flex", props: { direction: "column", gap: "3" },
    repeat: { source: { state: "/mantis/conversation/entries" }, key: "seq" }, children: [turnCard] },
  // a repeat over an empty list renders nothing at all, so a loaded
  // conversation with no turns is said out loud: the guard is the conversation
  // it belongs to, and the note itself asks the first turn whether there is one
  { component: "Flex", props: { direction: "column" },
    visible: { source: { state: "/mantis/conversation/conversationId" } },
    children: [{ component: "Text", props: { value: "This conversation has no turns yet.", size: "2", color: "gray" },
      visible: { source: { state: "/mantis/conversation/entries/0" }, not: true } }] },
  // and before any conversation has been loaded, the timeline names the press
  // that fills it instead
  { component: "Text", props: { value: "Press Load timeline on a conversation to fill this timeline.", size: "2", color: "gray" },
    visible: { source: { state: "/mantis/conversation/conversationId" }, not: true } },
])

const conversations: UiNodeSpec = section("Conversations", [
  ...sharedSourceStates("state", "/mantis/state/conversations", "No conversation has been held yet."),
  table(["Conversation", "Turns", "Action"],
    [codeCell("conversationId"), cell("turns"),
      cellOf(row([{ component: "Button", props: { value: "Load timeline", size: "1" }, onPress: "mantis.conversation",
        params: { conversationId: { item: "conversationId" } } }]))],
    { source: { state: "/mantis/state/conversations" }, key: "conversationId" }),
  // a load that failed is reported by the list that was pressed, not silently
  row([errorBadge("/mantis/conversation")]),
])

export const chatNodes: readonly UiNodeSpec[] = [composer, timeline, conversations]
