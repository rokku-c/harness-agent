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
