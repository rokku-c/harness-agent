/**
 * Every press this view can make, and what each one leaves behind.
 *
 * `clear` is what the press consumed and `refresh` is what its answer moved.
 * Both run only on a successful call, so a refused press never eats the draft
 * that caused it and never re-reads over the sentence explaining the refusal.
 *
 * The three `deck.reload*` actions are the retries of the three reads, and they
 * are actions rather than a second call inside a press because that is the only
 * thing a `Try again` can be: a control runs a declared action, and the deck's
 * source `refreshMs` is a timer, which is not a control an operator can press
 * (§9, H12). Each carries no `result`: the answer worth reading is the source's
 * own verdict, which the read writes to `/_sources/<id>` either way, so a retry
 * that fails says so once, in the place the first failure was read.
 *
 * There are two reads of a session's history, and the difference between them is
 * the whole reason for the second. `deck.load` is what entering the screen runs,
 * and it empties the turn draft: a draft carried in from another session is a
 * turn addressed to the wrong agent. `deck.reloadSession` is the same read for a
 * reader who is already here, and it empties nothing — a retry that discarded the
 * turn being typed would make the retry the more destructive of the two presses.
 */
import { NAV_ROOT, type UiActionSpec } from "@effect-agent/effect-ui"

export const deckActions: readonly UiActionSpec[] = [
  // Nothing to read first: these screens are destinations, and the doors on the
  // start screen are already there.
  { name: "deck.new", opens: "new" },
  { name: "deck.catalog", opens: "catalog" },
  // A row's Open names the session and goes there; the screen reads it on entry.
  // A row and a pasted address are therefore one act and one read, not two.
  { name: "deck.open", opens: "session" },
  { name: "deck.load", method: "GET", url: "/deck/api/session/{sessionId}/history", result: "/opened",
    params: { sessionId: { state: `${NAV_ROOT}/sessionId` } }, clear: ["/message/text", "/result/turn", "/result/retry"] },
  { name: "deck.reloadSession", method: "GET", url: "/deck/api/session/{sessionId}/history", result: "/opened",
    params: { sessionId: { state: `${NAV_ROOT}/sessionId` } } },
  { name: "deck.create", method: "POST", url: "/deck/api/session", result: "/result/open",
    clear: ["/create/sessionId", "/create/prompt"], refresh: ["deck"] },
  // Closing a session changes what its transcript says, so the transcript is read
  // again: the read of a session that is gone refuses, and that refusal is read on
  // the screen showing that transcript. Clearing the detail here instead would
  // blank it whichever session was closed, including one the operator is reading.
  { name: "deck.close", method: "POST", url: "/deck/api/session/{sessionId}/close", result: "/result/session", refresh: ["deck", "deck.load"] },
  { name: "deck.closeAll", method: "POST", url: "/deck/api/sessions/close-all", result: "/result/session", refresh: ["deck", "deck.load"] },
  // A turn changes the transcript, so the transcript is one of the reads this
  // press runs again — otherwise the reply the deck just wrote to `/result/turn`
  // is the only sign the turn happened. Send and retry answer to separate roots:
  // they fail for different reasons, and one readout for both would retry the
  // wrong request.
  { name: "deck.send", method: "POST", url: "/deck/api/session/{sessionId}/send", result: "/result/turn",
    clear: ["/message/text"], refresh: ["deck", "deck.load"] },
  { name: "deck.retry", method: "POST", url: "/deck/api/session/{sessionId}/retry", result: "/result/retry", refresh: ["deck", "deck.load"] },
  // A decision changes the session's transcript as well as the queue, so both
  // reads run again: a consent that released a blocked turn leaves a new reply,
  // and the screen the decision was made from is the one that must show it.
  { name: "deck.allow", method: "POST", url: "/deck/api/consent/{callId}", result: "/result/consent", refresh: ["deck", "deck.load"] },
  { name: "deck.deny", method: "POST", url: "/deck/api/consent/{callId}", result: "/result/consent", refresh: ["deck", "deck.load"] },
  { name: "deck.removeLauncher", method: "DELETE", url: "/deck/api/launchers/{label}?kind={kind}", result: "/result/launcher", refresh: ["launchers"] },
  { name: "deck.reload", method: "GET", url: "/deck/api/deck", refresh: ["deck"] },
  { name: "deck.reloadLaunchers", method: "GET", url: "/deck/api/launchers", refresh: ["launchers"] },
  { name: "deck.reloadPresets", method: "GET", url: "/deck/api/presets", refresh: ["presets"] },
]
