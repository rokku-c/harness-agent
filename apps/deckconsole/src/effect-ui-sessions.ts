/**
 * The sessions this deck is running.
 *
 * This is the console's first screen and what an operator comes back to, so it
 * is a list of what exists rather than of what to do: a row's Open leaves for
 * that session's own screen, which holds the whole of working in it. A session's
 * identity is the agent running it — the generated id is the key that addresses
 * it, so it wears the code chip rather than standing at the head of the row.
 *
 * Close all is guarded on the list having a row, because a close-all over
 * nothing is a press that reports success for having done nothing. It carries no
 * confirmation, and that is a gap rather than a choice: `flows.md` §6.3 requires
 * a destructive press to name what it acts on, `design-system.md` §11.3 gives
 * that confirmation exactly one shape (`AlertDialog`), and this layer cannot
 * build it — see the report. The label is therefore as plain as it can be about
 * what it does, and no second, invented interlock stands in for the dialog.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, code, emptyRows, press, readout, row, section, stateBadge, stateRows, table, text, tryAgain, whenRows } from "./effect-ui-nodes.ts"

const cells: readonly UiNodeSpec[] = [
  cellOf(stateBadge("kind")),
  cellOf(code("sessionId")),
  cellOf(stateBadge("status")),
  cellOf(row([
    press("Open", "deck.open", { sessionId: { item: "sessionId" } }, { size: "1" }),
    press("Close", "deck.close", { sessionId: { item: "sessionId" } }, { size: "1", variant: "soft", color: "red" }),
  ])),
]

export const sessionsCard: UiNodeSpec = section("Sessions", [
  text("Every session this deck is running. A session keeps running after you leave its screen.", { size: "2", color: "gray" }),
  emptyRows("deck", "/deck/sessions", "No session is open. Open session starts one."),
  whenRows(stateRows("/deck/sessions"), table(["Agent", "Session", "Status", "Actions"], cells, { source: { state: "/deck/sessions" }, key: "sessionId" })),
  whenRows(stateRows("/deck/sessions"), row([press("Close all sessions", "deck.closeAll", undefined, { size: "1", variant: "soft", color: "red" })])),
  readout("/result/session/error", tryAgain("deck.reload")),
])
