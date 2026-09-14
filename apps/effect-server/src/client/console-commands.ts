/**
 * What the command palette offers: `flows.md` §6.4's eight groups, in its order,
 * in one of its two modes.
 *
 * The contents are the flows document's and the presentation is the chrome
 * design's (§10.2, §10.3): a row is still a ghost `Button` with a glyph, a label,
 * a caption and its key. `design-system.md` §10.3's own list of seven groups is
 * the thing this replaces — it cannot reach the Inbox, and a palette that cannot
 * reach the Inbox cannot reach the surface the flows design exists for
 * (`plan.md` §9).
 *
 * A row invents no destination. Every one carries a `ConsoleRoute` built from the
 * app's own catalogue entry, the place's own declared route, or the payload the
 * mounted view was built from, and the palette hands that route to `navigate` —
 * which is `hashOf` and the address bar. So the palette is a second control over
 * the routes the console already answers, and not a second navigation graph.
 *
 * The caption is the only grouping signal, and that is deliberate: §10.3's row
 * shape is exactly a glyph, a label, a caption and a key, and inventing a heading
 * widget to say "Screens" above five rows would be chrome the design did not ask
 * for. So a screen's caption reads `Screen · Board`, and the eight groups are
 * distinguishable without a second component.
 *
 * Every row that goes somewhere shows the address it goes to (§6.4 rule 6). A row
 * that only acts has none, and does not get one: an invented address would teach
 * a link the console does not answer.
 *
 * One group is not built here. A pasted address is a row whose resolution lives
 * with the surfaces (`console-palette-address.tsx`), so the palette puts it in
 * front of these; a query that is not an address is searched like any other text
 * and gets no row of its own (§6.4 rule 3). Narrowing and ranking these rows is
 * `console-command-search.ts`'s question, not this file's.
 */

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

/** §6.4's two modes: the same field, the same rows, and in Go to, the destinations only. */
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
  /** What kind of thing this is, and the app it belongs to: the palette's only grouping signal. */
  readonly caption: string
  readonly glyph: string
  /** The key the console already binds for this action, when it binds one. */
  readonly shortcut?: string
  /** The address this row goes to. Absent on a row that only acts (§6.4 rule 6). */
  readonly address?: string
  /** The app this row belongs to, so ranking can put the open app's own rows first. */
  readonly owner?: string
  readonly action: CommandAction
}

/** Everything §6.4's eight groups are built from: the catalogue, the address, and the three lists the palette reads. */
export interface PaletteInput {
  readonly plan: readonly ConsoleEntry[]
  readonly route: ConsoleRoute
  readonly places: readonly Place[]
  /**
   * The app whose view is mounted, when one is. Not the app the query names: a
   * screen can be shown for any app, but only the mounted app's actions exist to
   * run, and only its own payload lists them.
   */
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
  // Go to is the palette with the doors only. A mode that could also write is a mode an
  // operator would learn not to trust with their hands already on the keys (§6.4).
  ...(input.mode === "commands" ? [...actionRows(input), ...consoleRows(input)] : []),
]

