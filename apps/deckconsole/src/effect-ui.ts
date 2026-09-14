/**
 * The deck control room, in four screens.
 *
 * The first screen is what the deck is doing: the asks waiting on an operator,
 * which is the press that releases an agent, and the sessions it is running,
 * which is what an operator comes back for. From there a row's Open enters that
 * session's own screen, and the doors at the top open the form that starts one
 * and the catalogue of what it can be started as.
 *
 * The doors are the design system's own door in the design system's own group
 * (`design-system.md` §10.2.5), and this screen no longer draws a title of its
 * own. The chrome above every surface already names it, so a second heading with
 * the same words was the page restating the bar — and DESIGN_VARIANCE:3 gives a
 * screen one shape for a destination, not a header shape of its own. They sit
 * outside the scrolling region because the region scrolls: a way out that scrolls
 * away with the content is not a way out.
 *
 * The deck's one source carries both of the first screen's lists, so its read is
 * stated once, above them, with the one retry that reads it again. Each list then
 * says its own emptiness, because a source that carries six arrays can never
 * report that one of them is empty (`empty-rows.ts`). The catalogue's two lists
 * read two other sources and state their own read, on their own screen.
 *
 * The consent policy the `new` screen carries is the reason this view is not
 * purely a presentation change; `effect-ui-new.ts` and `effect-ui-state.ts` hold
 * the two halves of it and the note on why it is load-bearing.
 */
import { region, type EffectUiView } from "@effect-agent/effect-ui"
import { deckActions } from "./effect-ui-actions.ts"
import { catalogNodes } from "./effect-ui-catalog.ts"
import { door, doorRow, loadingRows, sourceRead, tryAgain } from "./effect-ui-nodes.ts"
import { newSession } from "./effect-ui-new.ts"
import { pendingQueue } from "./effect-ui-pending.ts"
import { sessionRoom } from "./effect-ui-room.ts"
import { sessionsCard } from "./effect-ui-sessions.ts"
import { deckState } from "./effect-ui-state.ts"

export const effectUiView: EffectUiView = {
  viewId: "deck-console",
  title: "Deck control room",
  state: deckState,
  sources: [
    { id: "deck", url: "/deck/api/deck", state: "/deck", refreshMs: 5000 },
    { id: "launchers", url: "/deck/api/launchers", state: "/launchers", refreshMs: 10000 },
    { id: "presets", url: "/deck/api/presets", state: "/presets", refreshMs: 10000 },
  ],
  actions: deckActions,
  nodes: [
    doorRow("Screens of Deck control room", [
      door("Open session", "deck.new"),
      door("Launchers and presets", "deck.catalog"),
    ]),
    region([
      loadingRows("deck", 3),
      sourceRead("deck", tryAgain("deck.reload")),
      // An agent is blocked until a decision on the queue is made, so the queue
      // comes before the list of what is already running.
      pendingQueue,
      sessionsCard,
    ]),
  ],
  screens: [
    { id: "new", title: "Open session", nodes: newSession },
    { id: "session", title: "Session", onEnter: "deck.load", nodes: sessionRoom },
    { id: "catalog", title: "Launchers and presets", nodes: catalogNodes },
  ],
}
