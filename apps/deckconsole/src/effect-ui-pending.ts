/**
 * What is waiting on an operator, on the screen they arrive at.
 *
 * The queue is the deck's own answer from `deck`, which reads it every five
 * seconds, so a decision raised while this page is open appears without a press.
 * Its emptiness is asked of the list and not of the source: the deck's answer
 * holds six arrays, the runtime decides "empty" from all of them together, and a
 * source that carries one session and no asks reads `ready` — so the source's
 * verdict can never say that this list is empty (`empty-rows.ts`). The read's
 * loading and failure are stated once for the whole screen, in `effect-ui.ts`,
 * because both lists here read that one answer.
 *
 * The refusal is read under the queue rather than under the row, and its retry
 * reads the queue again. A row's press carries the row's own call id, and the
 * deck refuses a decision with "unknown or already decided" — which is the queue
 * saying it has moved on. Re-reading it is therefore the one request still aimed
 * at something, and the row's own Allow and Deny are still live beside it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { decisionPresses } from "./effect-ui-decisions.ts"
import { cell, cellOf, code, emptyRows, readout, section, stateRows, table, text, tryAgain, whenRows } from "./effect-ui-nodes.ts"

export const pendingQueue: UiNodeSpec = section("Waiting on you", [
  text("Nothing an agent asks to run happens until it is decided. The session that raised an ask can answer it too.", { size: "2", color: "gray" }),
  emptyRows("deck", "/deck/pending", "Nothing is waiting on you. An agent's ask appears here the moment it needs a decision."),
  whenRows(stateRows("/deck/pending"), table(["Tool", "Session", "Decision"],
    [cell("tool"), cellOf(code("sessionId")), decisionPresses],
    { source: { state: "/deck/pending" }, key: "callId" })),
  readout("/result/consent/error", tryAgain("deck.reload")),
])
