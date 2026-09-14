/**
 * What this deck can start: the launchers saved for it, and the CLI presets it
 * can invoke.
 *
 * Both are lists of agent kinds, so both lead with the kind — a label names one
 * saved configuration of a kind and is the key the remove press addresses, not
 * the row's identity. The two hold different things in the same shape, so each
 * says in a line what it is and where it comes from.
 *
 * Each has its own source, so each states its own read: loading, empty, and
 * failed with the retry that reads that one again. Nothing here reads `deck`,
 * which is why the start screen's failure notice is not repeated on this screen —
 * a screen that reported a read it never made would be counting another screen's
 * failure as its own.
 *
 * A launcher's Remove carries no confirmation either, for the same reason
 * `Close all` does not (see `effect-ui-sessions.ts` and the report). Its label
 * names the row it is in, which is all this layer can do.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, code, line, readout, press, row, section, sourceStatesRetry, stateBadge, stateRows, table, text, tryAgain, whenRows } from "./effect-ui-nodes.ts"

const launcherCells: readonly UiNodeSpec[] = [
  cellOf(stateBadge("kind")),
  cellOf(line("label", { weight: "medium" })),
  cellOf(row([
    press("Remove", "deck.removeLauncher", { label: { item: "label" }, kind: { item: "kind" } },
      { size: "1", variant: "soft", color: "red" }),
  ])),
]

const presetCells: readonly UiNodeSpec[] = [cellOf(stateBadge("kind")), cellOf(code("file"))]

export const catalogNodes: readonly UiNodeSpec[] = [
  section("Launchers", [
    text("Saved configurations this deck can launch, one per label. An agent's add-launcher tool saves one.", { size: "2", color: "gray" }),
    ...sourceStatesRetry("launchers", "No launcher is saved for this deck. One appears here when the deck is configured with it.", tryAgain("deck.reloadLaunchers")),
    whenRows(stateRows("/launchers/launchers"), table(["Agent", "Launcher", "Actions"], launcherCells,
      { source: { state: "/launchers/launchers" }, key: "label" })),
    readout("/result/launcher/error", tryAgain("deck.reloadLaunchers")),
  ]),
  section("CLI presets", [
    text("Commands this deck can invoke, one per agent kind. An agent's add-preset tool registers one.", { size: "2", color: "gray" }),
    ...sourceStatesRetry("presets", "No CLI preset is registered. One appears here when the deck is configured with it.", tryAgain("deck.reloadPresets")),
    whenRows(stateRows("/presets/presets"), table(["Agent", "Command"], presetCells,
      { source: { state: "/presets/presets" }, key: "kind" })),
  ]),
]
