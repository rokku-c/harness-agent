import { NAV_ROOT, type UiNodeSpec } from "@effect-agent/effect-ui"
import { sessionDecisions } from "./effect-ui-decisions.ts"
import { codeAt, failureReadout, field, press, readout, row, section, text, tryAgain } from "./effect-ui-nodes.ts"
import { transcript } from "./effect-ui-transcript.ts"

const sendParams = { sessionId: { state: "/opened/sessionId" }, text: { state: "/message/text" } }
const sessionParam = { sessionId: { state: "/opened/sessionId" } }

const turnForm: readonly UiNodeSpec[] = [
  field("Turn text", { component: "TextArea", bind: "/message/text" }),
  row([
    press("Send turn", "deck.send", sendParams),
    press("Retry last turn", "deck.retry", sessionParam, { variant: "soft" }),
  ]),
  readout("/result/turn/error", tryAgain("deck.send", sendParams)),
  readout("/result/retry/error", tryAgain("deck.retry", sessionParam)),
]

export const sessionRoom: readonly UiNodeSpec[] = [
  failureReadout("/opened/error", tryAgain("deck.reloadSession")),
  { ...text("No session is open. Open one from the sessions list.", { size: "2", color: "gray" }),
    visible: { source: { state: `${NAV_ROOT}/sessionId` }, not: true } },
  { component: "Flex", props: { direction: "column", gap: "4" },
    visible: { source: { state: "/opened/ok" } },
    children: [
      row([codeAt("/opened/sessionId")]),
      text("This session keeps running while you are away from this screen. Closing it is a press on the sessions list.", { size: "2", color: "gray" }),
      section("Send turn", turnForm),
      sessionDecisions,
      transcript,
    ] },
]
