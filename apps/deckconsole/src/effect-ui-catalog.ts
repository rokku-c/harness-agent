/**
 * What this deck can start: the launchers saved for it, and the CLI presets it
 * can invoke. Both are lists of agent kinds, so both lead with the kind — a label
 * names one saved configuration of a kind, and it is the key the remove press
 * addresses rather than the row's identity. The two lists hold different things
 * and have the same shape, so each one says in a line what it is.
 */

import { failureBadge, row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { sourceStates } from "@effect-agent/effect-ui/source-status"
import { cellOf, code, line, press, section, stateBadge, table, text } from "./effect-ui-nodes.ts"

const launcherCells: readonly UiNodeSpec[] = [
  cellOf(stateBadge("kind")),
  cellOf(line("label", { weight: "medium" })),
  cellOf(row([
    press("Remove", "deck.removeLauncher", { label: { item: "label" }, kind: { item: "kind" } }, { size: "1", variant: "soft", color: "red" }),
  ])),
]

const presetCells: readonly UiNodeSpec[] = [cellOf(stateBadge("kind")), cellOf(code("file"))]

export const catalogNodes: readonly UiNodeSpec[] = [
  section("Launchers", [
    text("Saved configurations this deck can launch, one per label.", { size: "2", color: "gray" }),
    ...sourceStates("launchers", "No launchers are registered."),
    table(["Agent", "Launcher", "Actions"], launcherCells, { source: { state: "/launchers/launchers" }, key: "label" }),
    row([failureBadge("/result/launcher/error")]),
  ]),
  section("Presets", [
    text("CLI commands the deck can invoke, one per agent kind.", { size: "2", color: "gray" }),
    ...sourceStates("presets", "No CLI presets are registered."),
    table(["Agent", "Command"], presetCells, { source: { state: "/presets/presets" }, key: "kind" }),
  ]),
]
