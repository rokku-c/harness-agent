/**
 * A consent decision: the presses that answer one, and the two lists that show
 * one.
 *
 * A decision is one object — the ask, the tool, the session it belongs to, and
 * the verdict once a human has given one — and this app reads it twice: the
 * start screen's queue of what is still waiting, and the session screen's record
 * of what was decided for the session on screen. Both read the deck's own fields
 * through the same cells, because writing them as two shapes is what left a
 * decision answerable from one screen and invisible from the other
 * (`flows.md` §7.8 dead end 1, J1).
 *
 * The verdict is the decision's own field, read and never inferred. A `pending`
 * entry is the one that carries presses, and an answered one shows its answer in
 * place of controls the deck would refuse as already decided — so no screen needs
 * its own rule about which rows are still open, and a decision made in the queue
 * is answered on the session screen the moment the transcript is read again.
 */
import type { UiCondition, UiNodeSpec } from "@effect-agent/effect-ui"
import { cell, cellOf, emptyMessage, press, row, section, stateRows, table, text, whenRows } from "./effect-ui-nodes.ts"

/** The one word the deck uses for a decision nobody has made yet. */
const waiting: UiCondition = { source: { item: "decision" }, equals: "pending" }

/**
 * The three verdicts, each in the design system's own tone (§3.3). Four hues
 * carry five tones, so allowed is the accent's quiet surface, denied is red with
 * no fill, and waiting is amber; the fill separates the two reds and the word
 * separates them again for a reader who cannot see colour.
 *
 * All three badges are drawn in every row and the guard picks one, because the
 * tone is a function of a declared field and the language compares values rather
 * than computing one.
 */
const VERDICTS = [
  { field: "allow", word: "Allowed", variant: "surface", color: "jade" },
  { field: "deny", word: "Denied", variant: "outline", color: "red" },
  { field: "pending", word: "Waiting", variant: "soft", color: "amber" },
] as const

const verdict: UiNodeSpec = {
  component: "Flex", props: { gap: "2", wrap: "wrap" },
  children: VERDICTS.map((one): UiNodeSpec => ({
    component: "Badge", props: { value: one.word, variant: one.variant, color: one.color, highContrast: true },
    visible: { source: { item: "decision" }, equals: one.field },
  })),
}

export const verdictCell: UiNodeSpec = cellOf(verdict)

/**
 * Allow and Deny, on a decision still waiting and on no other.
 *
 * Both name `allow` explicitly because the deck's route reads an absent one as a
 * denial: a press that left it out would deny the call while reading "Allow".
 * Allow leads and is solid; Deny is the half that does not come back and reads as
 * secondary beside it.
 */
export const decisionPresses: UiNodeSpec = cellOf({
  component: "Flex", props: { gap: "2" }, visible: waiting,
  children: [
    press("Allow", "deck.allow", { callId: { item: "callId" }, allow: true }, { size: "1" }),
    press("Deny", "deck.deny", { callId: { item: "callId" }, allow: false }, { size: "1", variant: "soft", color: "red" }),
  ],
})

/**
 * Who gave the verdict, and when. Both are the deck's own fields and both are
 * shown raw: a timestamp this page reformatted would be a second opinion about
 * when the decision was made.
 */
const answered: UiNodeSpec = cellOf(row([
  { component: "Text", props: { size: "2" }, item: "by" },
  { component: "Text", props: { size: "1", color: "gray" }, item: "decidedAt" },
]))

/**
 * The decisions recorded for the session on screen, newest first.
 *
 * This is dead end 1's fix. An agent blocked on a call can be released from the
 * screen an operator is already reading, not only from a queue they would have to
 * navigate back to; what makes that safe is J1's own rule, that the first verdict
 * wins and every surface reads the same record, so this list is not a second
 * authority over the decision — it is the same one seen closer.
 *
 * Its empty sentence is safe to state because the room around it is drawn only
 * once the read has answered: "no first row" here means this session asked for
 * nothing, never that the read is still in flight.
 */
export const sessionDecisions: UiNodeSpec = section("Decisions for this session", [
  text("Every consent ask this session has raised, newest first. The ones still waiting are answerable here.", { size: "2", color: "gray" }),
  emptyMessage("/opened/consent", "This session has not asked to run anything yet. An ask appears here the moment one is needed."),
  whenRows(stateRows("/opened/consent"), table(["Tool", "Verdict", "Decided by", "Decision"],
    [cell("tool"), verdictCell, answered, decisionPresses],
    { source: { state: "/opened/consent" }, key: "callId" })),
])
