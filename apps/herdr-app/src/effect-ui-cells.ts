/**
 * How one row of this console renders what it carries: the plain cell, the mono
 * chip for a key or a path, the badge for a kind, the state badge, and the one
 * press a row owns.
 *
 * A row leads with what an operator recognizes — the title Herdr is running the
 * agent under — and keeps the id the console addresses it by underneath, because
 * a pane id is something an operator correlates against a log and never something
 * anyone reads a column of.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, row } from "./effect-ui-nodes.ts"

/** A key the console addresses a record by, or a path it was found in: read one character at a time. */
export const mono = (field: string): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", variant: "soft" }, item: field })

/** That chip in a cell of its own. */
export const monoCell = (field: string): UiNodeSpec => cellOf([mono(field)])

/**
 * A row's identity: the name an operator reads, over the id every press on this
 * screen sends. The stack is aligned to its start because a column stretches what
 * it holds, and a stretched key paints as a bar under the name rather than as the
 * chip it is.
 */
export const identity = (name: string, id: string): UiNodeSpec => cellOf([
  { component: "Flex", props: { direction: "column", gap: "1", align: "start" }, children: [
    { component: "Text", item: name }, mono(id),
  ] },
])

/**
 * The kind of agent a pane holds — `claude`, `codex`.
 *
 * §3.5's fourth case: a distinguishing literal that is neither health nor a
 * problem. Blue is the tone for it, and highContrast is §3.4's rule for a badge
 * that carries a tone at all.
 */
export const kindBadge = (field: string): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", color: "blue", highContrast: true }, item: field })

/**
 * Herdr's lifecycle word for an agent.
 *
 * `blocked` is Herdr's word for an agent waiting on an approval, which is §3.5's
 * third case — an outstanding human decision — so it is the one state that takes
 * a tone. Every other state is one of several spelled answers to "how is it
 * getting on", which is the fifth case: plain, with no colour to disagree with
 * the server's own word. The two read the same field and are exact complements
 * (`not`), so a row cannot render both or neither.
 */
export const stateBadge = (field: string): UiNodeSpec => row([
  { component: "Badge", props: { variant: "soft", color: "amber", highContrast: true }, item: field,
    visible: { source: { item: field }, equals: "blocked" } },
  { component: "Badge", props: { variant: "soft" }, item: field,
    visible: { source: { item: field }, equals: "blocked", not: true } },
])

/** That badge in a cell of its own. */
export const stateCell = (field: string): UiNodeSpec => cellOf([stateBadge(field)])

/**
 * Which pane an operator is looking at, and which they are not.
 *
 * A word rather than a badge or a blank: "behind" and "in front" are the two
 * answers, and an empty cell would be read as a third one. It is not a tone —
 * focus is not a verdict, an error, a decision or a kind.
 */
export const frontCell = (field: string): UiNodeSpec => cellOf([
  { component: "Text", props: { value: "in front", size: "2" }, visible: { source: { item: field } } },
  { component: "Text", props: { value: "behind", size: "2", color: "gray" },
    visible: { source: { item: field }, not: true } },
])

/**
 * The one press a row owns: the agent it is standing on, and the screen that shows
 * it. Written out as a literal rather than built, because it is the only press in
 * this console that carries a value of its own — the pane the row stands on — and
 * a literal `onPress` is the form `scripts/check-ui.ts` can see and check.
 */
export const openCell: UiNodeSpec = cellOf([
  row([{ component: "Button", props: { value: "Open", size: "1", variant: "soft" },
    onPress: "herdr.openAgent", params: { target: { item: "pane_id" } } }]),
])
