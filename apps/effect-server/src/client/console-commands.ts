import { destinationRows } from "./console-command-destinations.ts"
import { decisionRows, operationRows } from "./console-command-host.ts"
import { actionRows, consoleRows } from "./console-command-console.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { ConsoleRoute } from "./console-route.ts"
import type { Decision } from "./console-decision.ts"
import type { InspectorPayload } from "./inspector-types.ts"
import type { Place } from "./console-place.ts"
import type { ViewPayload } from "./console-view-read.ts"
import type { ThemeMode } from "./theme-runtime.ts"

export type PaletteMode = "commands" | "goto"

export type CommandAction =
  | { readonly kind: "go"; readonly route: ConsoleRoute }
  | { readonly kind: "appearance"; readonly mode: ThemeMode }
  | { readonly kind: "read" }
  | { readonly kind: "shortcuts" }
  | { readonly kind: "copy" }
  /** A declared action of the open app, run the way its own control would run it. */
  | { readonly kind: "run"; readonly app: string; readonly name: string }

export interface CommandRow {
  readonly id: string
  readonly label: string
  readonly caption: string
  readonly glyph: string
  readonly shortcut?: string
  readonly address?: string
  readonly owner?: string
  readonly action: CommandAction
}

export interface PaletteInput {
  readonly plan: readonly ConsoleEntry[]
  readonly route: ConsoleRoute
  readonly places: readonly Place[]
  readonly open?: string
  readonly view?: ViewPayload
  readonly operations: readonly InspectorPayload[]
  readonly decisions: readonly Decision[]
  readonly mode: PaletteMode
}

export const commandRows = (input: PaletteInput): readonly CommandRow[] => [
  ...destinationRows(input),
  ...operationRows(input),
  ...decisionRows(input),
  ...(input.mode === "commands" ? [...actionRows(input), ...consoleRows(input)] : []),
]
