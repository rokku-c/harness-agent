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
