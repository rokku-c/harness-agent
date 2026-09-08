import type { EffectUiView } from "@effect-agent/effect-ui"

/** Deck control room as a declarative effect-ui view (renderer-agnostic). */
export const effectUiView: EffectUiView = {
  viewId: "deck-console",
  title: "Deck control room",
  nodes: [
    { kind: "text", text: "deckconsole" },
    { kind: "list", items: ["sessions & consents", "launchers: claude-code · effect · demo"] },
    { kind: "button", label: "Open control room", onPress: "open.deck" },
  ],
}
