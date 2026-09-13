/**
 * The deck control room, in four screens.
 *
 * The first screen is what the deck is doing: the asks waiting on an operator,
 * which is the press that releases an agent, and the sessions it is running,
 * which is what an operator comes back for. From there a row's Open enters that
 * session's own screen, and the header's doors open the form that starts one and
 * the launchers and presets it can be started as.
 *
 * The session is a screen and not a detail beside the list because working in one
 * is a job: its transcript, the form that adds to it and the presses that change
 * it are one destination an operator enters and comes back from (Journey 3,
 * `docs/flows.md`). On a wide screen the list stays beside it, which is what the
 * two panes are — the same arrangement the hand-drawn grid used to state, now
 * stated by the host for every app.
 *
 * The deck's one source carries both of the first screen's lists, so its read is
 * stated once there and each list says its own emptiness: one failed read is one
 * fact, and a screen that shows it twice is a screen that counted it twice.
 */
import { NAV_ROOT, failureNotice, loadingRows, region, type EffectUiView } from "@effect-agent/effect-ui"
import { deckHeader } from "./effect-ui-header.ts"
import { newSession, sessionRoom, sessionsCard } from "./effect-ui-session.ts"
import { consentCard } from "./effect-ui-consent.ts"
import { catalogNodes } from "./effect-ui-catalog.ts"

export const effectUiView: EffectUiView = {
  viewId: "deck-console",
  title: "Deck control room",
  state: {
    deck: { sessions: [], pending: [], kinds: [] },
    launchers: { launchers: [] },
    presets: { presets: [] },
    create: { kind: "demo", sessionId: "", prompt: "" },
    message: { text: "" },
    // what the presses wrote, one root per section so a refusal is read where it happened
    result: { open: undefined, session: undefined, turn: undefined, consent: undefined, launcher: undefined },
    // the session a row opened: the transcript is read on demand, so the shape is
    // declared for the repeat to stand on, but `ok` stays undefined until a press
    // answers — that is what tells "not opened" apart from "opened, no turns"
    opened: { sessionId: "", turns: [] },
  },
  sources: [
    { id: "deck", url: "/deck/api/deck", state: "/deck", refreshMs: 5000 },
    { id: "launchers", url: "/deck/api/launchers", state: "/launchers", refreshMs: 10000 },
    { id: "presets", url: "/deck/api/presets", state: "/presets", refreshMs: 10000 },
  ],
  actions: [
    // Nothing to read first: the screen is a form, and the form is already there.
    { name: "deck.new", opens: "new" },
    { name: "deck.catalog", opens: "catalog" },
    // A press names the session and goes there. What fills the screen is the
    // screen's own business (`onEnter` below), so a row and an address pasted
    // into the bar are the same act and there is one read, not one per door.
    { name: "deck.open", opens: "session" },
    // Entering the session screen is what reads it. The id comes from the
    // address, which is where the press put it.
    { name: "deck.load", method: "GET", url: "/deck/api/session/{sessionId}/history", result: "/opened",
      params: { sessionId: { state: `${NAV_ROOT}/sessionId` } }, clear: ["/message/text", "/result/turn"] },
    { name: "deck.create", method: "POST", url: "/deck/api/session", result: "/result/open",
      clear: ["/create/sessionId", "/create/prompt"], refresh: ["deck"] },
    // Closing a session changes what its transcript says, so the transcript is read
    // again: the read of a session that is gone refuses, and its refusal is read on
    // the screen that shows that transcript. Clearing the detail here instead would
    // blank it whichever session was closed, including one the operator is reading.
    { name: "deck.close", method: "POST", url: "/deck/api/session/{sessionId}/close", result: "/result/session", refresh: ["deck", "deck.load"] },
    { name: "deck.closeAll", method: "POST", url: "/deck/api/sessions/close-all", result: "/result/session", refresh: ["deck", "deck.load"] },
    // A turn changes the session's transcript, so the transcript is one of the
    // reads this press runs again — otherwise the reply the deck just wrote to
    // `/result/turn` is the only sign the turn happened.
    { name: "deck.send", method: "POST", url: "/deck/api/session/{sessionId}/send", result: "/result/turn",
      clear: ["/message/text"], refresh: ["deck", "deck.load"] },
    { name: "deck.retry", method: "POST", url: "/deck/api/session/{sessionId}/retry", result: "/result/turn", refresh: ["deck", "deck.load"] },
    { name: "deck.allow", method: "POST", url: "/deck/api/consent/{callId}", result: "/result/consent", refresh: ["deck"] },
    { name: "deck.deny", method: "POST", url: "/deck/api/consent/{callId}", result: "/result/consent", refresh: ["deck"] },
    { name: "deck.removeLauncher", method: "DELETE", url: "/deck/api/launchers/{label}?kind={kind}", result: "/result/launcher", refresh: ["launchers"] },
  ],
  nodes: [
    deckHeader,
    // What the deck holds is as long as the deck is busy, and it is not what the
    // page is for: it scrolls in its own box, so the header's doors stay put.
    region([
      // the deck's own read, once, above the two lists it feeds
      loadingRows("deck", 3),
      failureNotice("deck"),
      // An agent is blocked until this is decided, so it comes before the list of
      // what is already running.
      consentCard,
      sessionsCard,
    ]),
  ],
  screens: [
    { id: "new", title: "Open session", nodes: newSession },
    { id: "session", title: "Session", onEnter: "deck.load", nodes: sessionRoom },
    { id: "catalog", title: "Launchers and presets", nodes: catalogNodes },
  ],
}
