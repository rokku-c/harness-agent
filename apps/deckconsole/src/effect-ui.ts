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
