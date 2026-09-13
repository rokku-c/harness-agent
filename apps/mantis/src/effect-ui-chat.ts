/**
 * The conversation an operator is in: the timeline they read and the composer
 * that adds to it.
 *
 * Both name the same conversation, and it is the one the read answered for. The
 * read writes its answer — id and turns together — to `/mantis/conversation`, so
 * the turns on screen and the conversation a message goes to are one fact read
 * from one path. A field of its own for the id would be a second, and a message
 * typed beside a timeline it is not addressed to is how a turn reaches a
 * conversation nobody was reading.
 *
 * This is the screen a row's Read enters, and either door completes it: the read
 * is run on entry from the id the address carries, so a pasted address shows the
 * same room a press shows. What it says when it has nothing to show is read from
 * the address and not from the answer — the answer is absent while the read is
 * in flight, and again for good when it failed, and "pick one from the list" is
 * the wrong thing to say to a reader who did pick one and is looking at the
 * reason it is not here.
 */

import { NAV_ROOT, failureCallout, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { acceptedBadge, errorBadge, refusalBadge } from "./effect-ui-feedback.ts"
import { field, press, section, stateBadge, text } from "./effect-ui-nodes.ts"

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

/**
 * The task itself, with its outcome under the button. The turn is waited out, so
 * the outcome is the whole turn's: the reply is in the timeline by the time this
 * says the message was accepted.
 */
const composer: UiNodeSpec = section("Send message", [
  // whose message this is: the conversation the room read, named once — the
  // button below carries the same value, so what is read here is what it sends
  row([text("Conversation", { size: "1", color: "gray" }), { component: "Code", bind: "/mantis/conversation/conversationId" }]),
  field("Message", { component: "TextArea", bind: "/message/text" }),
  row([press("Send", "mantis.send", {
    conversationId: { state: "/mantis/conversation/conversationId" }, text: { state: "/message/text" } })]),
  row([
    acceptedBadge("/mantis/send/accepted", "Message accepted"),
    refusalBadge("/mantis/send"),
    errorBadge("/mantis/send"),
  ]),
])

const timeline: UiNodeSpec = section("Conversation timeline", [
  { component: "Flex", props: { direction: "column", gap: "3" },
    repeat: { source: { state: "/mantis/conversation/entries" }, key: "seq" }, children: [turnCard] },
  // a repeat over an empty list renders nothing at all, so a conversation that
  // was read and holds no turns is said out loud
  { component: "Text", props: { value: "This conversation has no turns yet.", size: "2", color: "gray" },
    visible: { source: { state: "/mantis/conversation/entries/0" }, not: true } },
])

export const chatNodes: readonly UiNodeSpec[] = [
  failureCallout("/mantis/conversation/error"),
  { component: "Text", props: { value: "No conversation is open. Pick one from the list.", size: "2", color: "gray" },
    visible: { source: { state: `${NAV_ROOT}/conversationId` }, not: true } },
  { component: "Flex", props: { direction: "column", gap: "4" },
    visible: { source: { state: "/mantis/conversation/conversationId" } },
    children: [composer, timeline] },
]
