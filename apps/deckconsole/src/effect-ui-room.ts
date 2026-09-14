/**
 * The session screen: one session, the form that adds a turn to it, the
 * decisions it raised, and its transcript.
 *
 * Working in a session is a job, so it is a screen and not a detail beside the
 * list — its own address, its own read on entry, and a return control the host
 * draws. What this screen must say for itself is the thing `flows.md` §7.8 puts
 * under Exit: a session keeps running after the operator leaves it, and that is
 * the point of the app. On a wide screen the list stays beside this one, which
 * makes leaving it easy to do by accident and makes saying so load-bearing — an
 * operator who thought the session stopped with the pane would be wrong about
 * what their agent is doing right now.
 *
 * The room is guarded on the read's own `ok` and not on the session id it
 * answered with. Both are true after a successful read, but only `ok` is
 * distinguishable from the seeded shape: the id is an empty string until the read
 * lands, so a guard on it cannot tell "not read yet" from "read, and the session
 * is gone", and the two want opposite things on screen.
 */
import { NAV_ROOT, type UiNodeSpec } from "@effect-agent/effect-ui"
import { sessionDecisions } from "./effect-ui-decisions.ts"
import { codeAt, failureReadout, field, press, readout, row, section, text, tryAgain } from "./effect-ui-nodes.ts"
import { transcript } from "./effect-ui-transcript.ts"

const sendParams = { sessionId: { state: "/opened/sessionId" }, text: { state: "/message/text" } }
const sessionParam = { sessionId: { state: "/opened/sessionId" } }

/**
 * The presses carry the id the read answered with, so what is on screen is what
 * is sent, whichever row opened the room. Each failure has its own readout and
 * its own retry, because the two fail for different reasons: a send with an empty
 * session is refused for the session, a retry with nothing pending is refused for
 * the turn, and one readout for both would repeat the wrong request.
 */
const turnForm: readonly UiNodeSpec[] = [
  field("Turn text", { component: "TextArea", bind: "/message/text" }),
  row([
    press("Send turn", "deck.send", sendParams),
    // retry carries only the session: it sends again what that session last ran
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
