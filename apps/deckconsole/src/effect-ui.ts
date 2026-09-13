import { failureBadge, region, row, type EffectUiView, type UiNodeSpec } from "@effect-agent/effect-ui"
import { field, heading, press, section, text } from "./effect-ui-nodes.ts"
import { sessionNodes } from "./effect-ui-session.ts"
import { consentNodes } from "./effect-ui-consent.ts"
import { catalogNodes } from "./effect-ui-catalog.ts"

/**
 * One served agent kind, as a selectable item: the kind itself is the item's
 * value — `Select.Item`'s own `value` is part of its contract, so it cannot be
 * the content the `item` binding would otherwise become — and the same string
 * again as the label the operator reads.
 */
const kindOption = (field: string): UiNodeSpec => ({
  component: "Select.Item",
  item: field,
  as: "value",
  children: [{ component: "Text", item: field }],
})

/**
 * The kinds on offer are whatever the deck serves — the gateways it registered,
 * then the CLI presets it can invoke — so a kind added at boot shows up here and
 * a literal list of four could only ever be wrong. Two repeats because the deck
 * serves those two halves separately; the dropdown is one list of both.
 */
const kindPicker: UiNodeSpec = {
  component: "Select.Root",
  bind: "/create/kind",
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select an agent kind" } },
    { component: "Select.Content", children: [
      { component: "Select.Group", repeat: { source: { state: "/deck/kinds" } }, children: [kindOption("")] },
      { component: "Select.Group", repeat: { source: { state: "/presets/presets" } }, children: [kindOption("kind")] },
    ] },
  ],
}

/**
 * The page opens on the thing it exists for: picking a kind and opening a
 * session. Everything below it reads or acts on what that produces, so nothing
 * stands between the header and the press.
 */
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
    { name: "deck.open", method: "POST", url: "/deck/api/session", result: "/result/open", clear: ["/create/sessionId", "/create/prompt"], refresh: ["deck"] },
    { name: "deck.close", method: "POST", url: "/deck/api/session/{sessionId}/close", result: "/result/session", refresh: ["deck"] },
    { name: "deck.closeAll", method: "POST", url: "/deck/api/sessions/close-all", result: "/result/session", refresh: ["deck"] },
    // opening a row is the read that fills the detail beside it; the turn draft
    // and the last turn's readout belong to the session that was open, not this one
    { name: "deck.select", method: "GET", url: "/deck/api/session/{sessionId}/history", result: "/opened", clear: ["/message/text", "/result/turn"] },
    { name: "deck.send", method: "POST", url: "/deck/api/session/{sessionId}/send", result: "/result/turn", clear: ["/message/text"], refresh: ["deck"] },
    { name: "deck.retry", method: "POST", url: "/deck/api/session/{sessionId}/retry", result: "/result/turn", refresh: ["deck"] },
    { name: "deck.allow", method: "POST", url: "/deck/api/consent/{callId}", result: "/result/consent", refresh: ["deck"] },
    { name: "deck.deny", method: "POST", url: "/deck/api/consent/{callId}", result: "/result/consent", refresh: ["deck"] },
    { name: "deck.removeLauncher", method: "DELETE", url: "/deck/api/launchers/{label}?kind={kind}", result: "/result/launcher", refresh: ["launchers"] },
  ],
  nodes: [
    heading("Deck control room", { size: "6" }),
    text("Open agent sessions, send turns, read a transcript, and decide what an agent may run.", { size: "2", color: "gray" }),
    section("Open session", [
      field("Agent kind", kindPicker),
      // the deck names a session itself when this is left empty
      field("Session id (optional)", { component: "TextField.Root", bind: "/create/sessionId" }),
      field("Prompt", { component: "TextArea", bind: "/create/prompt" }),
      row([press("Open session", "deck.open",
        { kind: { state: "/create/kind" }, sessionId: { state: "/create/sessionId" }, prompt: { state: "/create/prompt" } })]),
      row([failureBadge("/result/open/error")]),
    ]),
    // What the form produces is as long as the deck is busy, and it is not what the
    // page is for: it scrolls in its own box, so the press that produced it stays put.
    region([...sessionNodes, ...consentNodes, ...catalogNodes]),
  ],
}
