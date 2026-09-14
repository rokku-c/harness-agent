/**
 * The conversation an operator is in: what it is holding, what was said, and the
 * composer that adds to it.
 *
 * The transcript is what scrolls; whatever needs an answer now is pinned above it
 * and the composer is pinned below. That placement is the design. A decision this
 * room is holding is the one thing on the screen that cannot wait, so it must not
 * be below a transcript that grows past the fold; and the field a turn is typed
 * into belongs where a chat's composer belongs, which is not something to scroll
 * back up to. The middle has to be a region, because the frame the shell gives a
 * screen is exactly one screen tall and a Card that does not fit is *shrunk*
 * rather than scrolled, with the bottom of the conversation quietly missing
 * (`region.ts`).
 *
 * What the composer sends is the conversation the read answered for, and not the
 * one the address named: the two are the same value on arrival and stop being the
 * same when an operator walks from one room to another, and a turn sent to the
 * conversation in the address bar is a turn in a room nobody is looking at.
 *
 * Send's style is the operator's choice, because the two styles fail differently.
 * Waited out, the answer is the turn's own outcome and the interface is held for
 * as long as the turn takes. Fired, the answer is only that the turn was accepted
 * and the reply lands later — which this console cannot watch for, since the
 * transcript is a read and not a stream. So the fired style says both of those:
 * what it does not have, and how the reply arrives.
 */

import { NAV_ROOT, type UiNodeSpec } from "@effect-agent/effect-ui"
import { decisionStrip } from "./effect-ui-decision-strip.ts"
import { decisionGate } from "./effect-ui-decisions.ts"
import { outcome } from "./effect-ui-feedback.ts"
import { failureCallout, field, press, region, row, section, stateValue, text } from "./effect-ui-nodes.ts"
import { timelineSection } from "./effect-ui-timeline.ts"

/** One fact, read in two places: the conversation's own read is what says a room is open. */
const OPEN = { source: { state: "/mantis/conversation/conversationId" } } as const

/**
 * The form. The switch is the one control in the design system that reports a
 * boolean, and the send action reads the path it writes, so the style declared
 * here is the style sent rather than a second copy of it in the action.
 *
 * `as: "checked"` is load-bearing and not decoration. A node's live value lands on
 * `value` unless the node says otherwise, and the control layer reads a bound
 * value off the prop the component actually *holds* it on — `checked`, for a
 * switch — so a switch declared without this draws a switch that flips on screen
 * and writes nothing back, and the send would use the default style while the
 * operator watched the control say otherwise (§11.2).
 */
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

/**
 * The fired style's own account of itself, shown only while it is the one in
 * force: a sentence that stayed on screen beside a waited send would describe the
 * wrong send. The read is a press and not a live source because a source's address
 * is declared, and this one's carries the conversation id — which the address bar
 * owns, not the view.
 */
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
  // The address, not the answer: the answer is absent while the read is in flight
  // and again for good when it failed, and "pick one from the list" is the wrong
  // thing to say to a reader who picked one and is looking at the reason.
  { component: "Text", props: { value: "No conversation is open. Pick one from the list, or name one.", size: "2", color: "gray" },
    visible: { source: { state: `${NAV_ROOT}/conversationId` }, not: true } },
  // The gate is repeated here rather than left to the start screen because this
  // is where its consequence lands: with decisions off, the strip below is empty
  // for the one reason a reader would otherwise have to guess.
  decisionGate,
  decisionStrip,
  { ...region([readAgain, timelineSection]), visible: OPEN },
  composer,
]
