/**
 * The directory: every identity the door can name, and the one switch each has.
 *
 * A row is read on its own — the name a person gave it if there is one, the key
 * the door resolves, whether it is on — and the switch sits at the end of that
 * same row. The two directions are one act with two values rather than two acts,
 * so a row offers exactly one of them: an identity that is on offers "Turn off",
 * and an identity that is off offers "Turn on".
 *
 * The press is on the row, which is not where herdr puts a list's acts, and the
 * difference is worth stating: what a press answers here *is* the row it was made
 * on — the badge beside it changes — so the answer has somewhere to be read. The
 * failure is the other way round and is stated once at the top of the card
 * instead of once per row, because one failure drawn on twenty rows is twenty
 * reports of it. It is very nearly always the same failure: the row was already
 * out of date, and the refresh that follows a write is what corrects it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { chip, emptyRows, failureBadge, identitiesSource, line, list, principalResult, principalsPath, press, recordRow, section, stack, stateBadge, stateRows, text, whenRows } from "./effect-ui-nodes.ts"

/** What the identity is called: a name if it was given one, and the key either way. */
const facts: readonly UiNodeSpec[] = [
  { ...line("displayName", { size: "2" }), visible: { source: { item: "displayName" } } },
  chip("key"),
  stateBadge("status"),
]

/** One act, two presses: each names the state it would put the identity in. */
const turn = (label: string, status: string, from: string, color?: string): UiNodeSpec => ({
  ...press(label, "gateway.setStatus", { kind: { item: "kind" }, id: { item: "id" }, status }, { size: "1", ...(color === undefined ? {} : { color }) }),
  visible: { source: { item: "status" }, equals: from },
})

const row: UiNodeSpec = stack([
  recordRow(facts, { component: "Flex", props: { gap: "2", align: "center" },
    children: [turn("Turn off", "disabled", "active", "red"), turn("Turn on", "active", "disabled")] }),
  line("created", { size: "1", color: "gray" }),
])

export const principalsSection: UiNodeSpec = section("Identities", [
  text("An identity that is off is refused at the door whatever token it still holds.", { size: "1", color: "gray" }),
  failureBadge(`${principalResult}/error`),
  emptyRows(identitiesSource, principalsPath, "No identity is registered yet. Issue a token above to make one."),
  whenRows(stateRows(principalsPath), list({ source: { state: principalsPath }, key: "key" }, row)),
])
