/**
 * The sessions this deck is running, and the one an operator opened.
 *
 * The list is the master surface and the opened session is the detail beside
 * it: opening a row fills the turn form and the transcript below, so an operator
 * sends a turn to the session they picked rather than typing its id again — a
 * hand-typed id is the one that goes to the wrong session.
 */

import { failureBadge, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, code, field, press, section, stateBadge, table, text } from "./effect-ui-nodes.ts"
import { sharedStates } from "./effect-ui-states.ts"
import { historyNodes } from "./effect-ui-history.ts"

/**
 * A session's identity is the agent running it — the generated id is the key
 * that addresses it, so it wears the code chip rather than standing at the head
 * of the row. Opening leads the row's presses because it is the read that fills
 * the detail; the destructive close reads as secondary beside it.
 */
const sessionCells: readonly UiNodeSpec[] = [
  cellOf(stateBadge("kind")),
  cellOf(code("sessionId")),
  cellOf(stateBadge("status")),
  cellOf(row([
    press("Open", "deck.select", { sessionId: { item: "sessionId" } }, { size: "1" }),
    press("Close", "deck.close", { sessionId: { item: "sessionId" } }, { size: "1", variant: "soft", color: "red" }),
  ])),
]

/**
 * A press that acts on a list is offered only while the list has a first row:
 * "close all sessions" under the notice that no session is open is an offer to
 * close nothing.
 */
const closeAll: UiNodeSpec = {
  ...row([press("Close all sessions", "deck.closeAll", undefined, { size: "1", variant: "soft", color: "red" })]),
  visible: { source: { state: "/deck/sessions/0" } },
}

/** Each refusal sits under the press that issued it: the open read, then the closes. */
const sessionsCard: UiNodeSpec = section("Sessions", [
  ...sharedStates("deck", "/deck/sessions", "No agent sessions are open yet."),
  table(["Agent", "Session", "Status", "Actions"], sessionCells, { source: { state: "/deck/sessions" }, key: "sessionId" }),
  row([failureBadge("/opened/error")]),
  closeAll,
  row([failureBadge("/result/session/error")]),
])

/** The session the turn form acts on: the row the operator opened, named once. */
const openedSession: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  visible: { source: { state: "/opened/sessionId" } },
  children: [
    // the turn field below is meant to fill the width, so the stack keeps stretching
    // and the session's key, which is sized to its content, takes the row
    row([{ component: "Code", bind: "/opened/sessionId" }]),
    field("Turn text", { component: "TextArea", bind: "/message/text" }),
    row([
      press("Send turn", "deck.send", { sessionId: { state: "/opened/sessionId" }, text: { state: "/message/text" } }),
      // retry carries only the session: it re-sends what that session last ran
      press("Retry last turn", "deck.retry", { sessionId: { state: "/opened/sessionId" } }, { variant: "soft" }),
    ]),
    row([failureBadge("/result/turn/error")]),
    // a turn that landed says so where the press was, and says nothing before one
    row([{ component: "Badge", props: { color: "green", variant: "soft", value: "Sent" },
      visible: { source: { state: "/result/turn/ok" } } }]),
  ],
}

const turnCard: UiNodeSpec = section("Send turn", [
  { ...text("Open a session row to send it a turn.", { size: "2", color: "gray" }),
    visible: { source: { state: "/opened/sessionId" }, not: true } },
  openedSession,
])

export const sessionNodes: readonly UiNodeSpec[] = [
  { component: "Grid", props: { columns: { initial: "1", lg: "2fr 1fr" }, gap: "5", align: "start" }, children: [
    sessionsCard,
    { component: "Flex", props: { direction: "column", gap: "4" }, children: [turnCard, ...historyNodes] },
  ] },
]
