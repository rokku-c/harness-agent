/**
 * The sessions this deck is running, the form that opens one, and the room an
 * operator works in one from.
 *
 * The list is the console's first screen: it is what the deck holds and what an
 * operator comes back to. A row's Open leaves it for that session's own screen,
 * which holds the whole of working in one session — its key, the form that sends
 * it a turn, and the transcript that turn lands in — so nothing an operator reads
 * is on the far side of a press from the thing that filled it. A hand-typed
 * session id is the one that goes to the wrong session, which is why the room
 * names its session once, from the row that opened it.
 */

import { NAV_ROOT, emptyRows, failureBadge, failureCallout, row, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, code, field, press, section, stateBadge, table, text } from "./effect-ui-nodes.ts"
import { kindPicker } from "./effect-ui-kinds.ts"
import { historyNodes } from "./effect-ui-history.ts"

/**
 * A session's identity is the agent running it — the generated id is the key
 * that addresses it, so it wears the code chip rather than standing at the head
 * of the row. Opening leads the row's presses because it is what leaves the
 * screen; the destructive close reads as secondary beside it.
 */
const sessionCells: readonly UiNodeSpec[] = [
  cellOf(stateBadge("kind")),
  cellOf(code("sessionId")),
  cellOf(stateBadge("status")),
  cellOf(row([
    press("Open", "deck.open", { sessionId: { item: "sessionId" } }, { size: "1" }),
    press("Close", "deck.close", { sessionId: { item: "sessionId" } }, { size: "1", variant: "soft", color: "red" }),
  ])),
]

const closeAll: UiNodeSpec = whenRows(stateRows("/deck/sessions"),
  row([press("Close all sessions", "deck.closeAll", undefined, { size: "1", variant: "soft", color: "red" })]))

/** The deck's sessions, as the first screen's own list. Opening one is where it leads. */
export const sessionsCard: UiNodeSpec = section("Sessions", [
  emptyRows("deck", "/deck/sessions", "No agent sessions are open yet."),
  whenRows(stateRows("/deck/sessions"), table(["Agent", "Session", "Status", "Actions"], sessionCells, { source: { state: "/deck/sessions" }, key: "sessionId" })),
  closeAll,
  // a close is issued from a row of this list, so its refusal is read here
  row([failureBadge("/result/session/error")]),
])

/** The form that opens one, on the screen the header's first door enters. */
export const newSession: readonly UiNodeSpec[] = [
  section("Open session", [
    field("Agent kind", kindPicker),
    // the deck names a session itself when this is left empty
    field("Session id (optional)", { component: "TextField.Root", bind: "/create/sessionId" }),
    field("Prompt", { component: "TextArea", bind: "/create/prompt" }),
    row([press("Open session", "deck.create",
      { kind: { state: "/create/kind" }, sessionId: { state: "/create/sessionId" }, prompt: { state: "/create/prompt" } })]),
    row([failureBadge("/result/open/error")]),
  ]),
]

/**
 * The task itself: the session this room is about, and the form that adds a turn
 * to it. The presses carry the id the read answered with, so what is read on
 * screen is what is sent, whichever row opened the room.
 */
const turnForm: readonly UiNodeSpec[] = [
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
]

/**
 * The room, as the screen a row opens: the session, the form that adds a turn to
 * it, and the transcript that turn lands in.
 *
 * What this screen says when it has nothing to show is read from the address and
 * not from the answer. The answer is absent while the read is in flight, and
 * again for good when it failed — and "open a session from the list" is the wrong
 * thing to say to a reader who did open one and is looking at the reason it is
 * not here.
 */
export const sessionRoom: readonly UiNodeSpec[] = [
  failureCallout("/opened/error"),
  { ...text("No session is open. Open one from the list.", { size: "2", color: "gray" }),
    visible: { source: { state: `${NAV_ROOT}/sessionId` }, not: true } },
  { component: "Flex", props: { direction: "column", gap: "4" },
    visible: { source: { state: "/opened/sessionId" } },
    children: [section("Send turn", turnForm), ...historyNodes] },
]
