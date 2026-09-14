/**
 * One conversation's transcript, oldest first.
 *
 * A turn is not a table row: a message and a tool step carry different fields,
 * and either one's body is prose of no fixed width. So the transcript is a run of
 * blocks in plain space, and a turn is a block rather than a card — a card per
 * turn is a card per sentence, and §7 admits one only where a block has an
 * identity and controls of its own, which a turn has neither of.
 *
 * The line a turn leads with holds what a reader scans for: where it sits in the
 * sequence, what kind it was, and — for a tool step — whether it is still running,
 * succeeded, or failed. Those three are signals and take the design system's
 * tones; the kind is an enumeration and takes the colourless badge, because
 * colour here means "this one is not finished" and a `msg` badge tinted blue
 * would say that about every message in the transcript.
 *
 * The timestamp is deliberately absent. It arrives as epoch milliseconds and a
 * declared view has no formatter, so it would print as a count no reader can
 * place; the sequence number says as much about order and is what the repeat
 * keys on.
 */

import { toneWhen, type UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyMessage, row, rowValue, section, stateBadge } from "./effect-ui-nodes.ts"

/** A field a turn may not have at all — a message has no tool, a note has no role. */
const present = (item: string, node: UiNodeSpec): UiNodeSpec => ({ ...node, visible: { source: { item } } })

/**
 * The three states a tool step can be in. Named once because the event ring
 * carries the same three on the same field: two screens giving one state two
 * words is how a reader stops trusting either of them.
 */
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

/**
 * The transcript itself. What it says when it is empty is `emptyMessage` rather
 * than a source's notice: a conversation is not a source, and this list's
 * emptiness is a fact about the answer the room's read already delivered — the
 * screen above shows the read failing, so this never has to say it.
 */
export const timelineSection: UiNodeSpec = section("Timeline", [
  emptyMessage("/mantis/conversation/entries", "This conversation has no turns yet."),
  { component: "Flex", props: { direction: "column", gap: "4" },
    repeat: { source: { state: "/mantis/conversation/entries" }, key: "seq" }, children: [entry] },
])
