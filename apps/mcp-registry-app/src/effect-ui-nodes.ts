/**
 * The node builders the registry console is written with: the framework's own,
 * re-exported so a section of this app names one place for its shapes, and the
 * one shape this console has an opinion of its own about — what a press
 * reported when it failed.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"

export { cell, cellOf, field, heading, list, section, table, text } from "@effect-agent/effect-ui"

/**
 * What a press reported when it failed. Guarded, because a readout bound before
 * the first press is an empty callout on the page rather than a state: the
 * action runtime writes `error` on failure and nothing else.
 */
export const failure = (bind: string): UiNodeSpec =>
  ({ component: "Callout.Root", props: { color: "red", size: "1" }, visible: { source: { state: bind } }, children: [{ component: "Callout.Text", bind }] })
