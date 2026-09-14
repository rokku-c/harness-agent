/**
 * What a press reported when it succeeded.
 *
 * The answer is a record and not a live read, so it says the one thing the
 * registry named back: the id it acted on. A press that said nothing would leave
 * an operator reading the list to find out whether it worked, which is the trip
 * the answer exists to save them.
 *
 * Guarded on that id and not on the press. An action writes `{ ok: false, error }`
 * where it writes this, so a guard on the press would report success over a
 * refusal — the one thing this node is here to prevent. The tone is `ok` because
 * the console's own answer being yes is what §3.1 reserves the accent for, and
 * the word is the verb that was done, so the meaning never rests on the colour.
 */
import { row, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"

/**
 * @param done the verb the registry performed, e.g. `Withdrawn`
 * @param named the path the answer's id landed at, e.g. `/withdraw/result/serverId`
 */
export const answer = (done: string, named: string): UiNodeSpec =>
  ({ ...row([toneBadge("ok", done), { component: "Code", bind: named }]),
    visible: { source: { state: named } } })
