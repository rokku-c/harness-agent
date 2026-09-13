/**
 * The node builders this console is written with: the shapes the framework
 * states once for every console, re-exported, and the few the canvas page has
 * an opinion of its own about — the figure the runtime reports, the value a
 * control is actually on, and a row's identity.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, text } from "@effect-agent/effect-ui"

export {
  cell, cellOf, failureCallout, field, heading, line, list, row, section, table, text,
} from "@effect-agent/effect-ui"

/** One figure the runtime reports: a small gray label over the live value. */
export const metric = (label: string, bind: string): UiNodeSpec => ({ component: "Card", props: { size: "1" }, children: [
  { component: "Flex", props: { direction: "column", gap: "1" }, children: [
    text(label, { size: "1", color: "gray" }),
    { component: "Text", props: { size: "7", weight: "bold", color: "blue" }, bind },
  ] },
] })

/**
 * The value a control does not change by itself: a picker edits a choice, and
 * this line is what the runtime is actually on. Without it a draft and a live
 * value look like the same figure stated twice.
 */
export const liveValue = (label: string, bind: string): UiNodeSpec =>
  ({ component: "Flex", props: { gap: "1", align: "center" }, children: [
    text(label, { size: "1", color: "gray" }),
    { component: "Text", props: { size: "1", weight: "medium" }, bind },
  ] })

/** An identifier is a key, not content: it reads as a chip, never as the row's first word. */
export const idCell = (item: string): UiNodeSpec => cellOf({ component: "Code", props: { size: "1" }, item })

/**
 * A row's identity: the name an operator reads, over the key the runtime
 * addresses it by. The stack is aligned to its start, because a column stretches
 * what it holds and a stretched key would paint as a bar under the name rather
 * than as the chip it is.
 */
export const identityCell = (name: string, key: string): UiNodeSpec =>
  cellOf({ component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [
    { component: "Text", item: name },
    { component: "Code", props: { variant: "soft", size: "1" }, item: key },
  ] })
