/**
 * How each card asks the control plane a question, and how the answer comes back
 * into the card that asked it.
 *
 * Two ways in: a button a row carries, run for the entity that row stands on,
 * and a button inside an answer, run for the entity the answer just named. Both
 * write the same declared result path, so one answer area serves both — and that
 * area is guarded on the action's own `ok`, so a card shows no empty readouts
 * before the first press and keeps the last answer readable while the next one
 * is in flight.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { row } from "@effect-agent/effect-ui"
import { field } from "./effect-ui-nodes.ts"

/** A request for the entity an answer named, rather than for a row's. */
export const request = (value: string, onPress: string, param: string, subject: string): UiNodeSpec =>
  ({ component: "Button", props: { value, size: "2" }, onPress, params: { [param]: { state: subject } } })

/** The same request, run by a row for the entity the row is standing on. */
export const rowRequest = (value: string, onPress: string, param: string, field: string): UiNodeSpec =>
  ({ component: "Button", props: { value, size: "1", variant: "soft" }, onPress, params: { [param]: { item: field } } })

/** An answer, in the card the press was made in. */
export const answer = (guard: string, children: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "Flex", props: { direction: "column", gap: "2" },
  visible: { source: { state: guard }, equals: true }, children: [...children],
})

/**
 * A list inside an answer: the sets an agent resolves to, the changes a plan
 * would make.
 *
 * It has no source verdict to lean on — the answer is the only thing that knows
 * the action ever ran — so when it carries nothing it says so in the line the
 * entries would have taken, rather than leaving a label over a blank.
 */
export const answered = (label: string, path: string, entry: readonly UiNodeSpec[], empty = "none"): UiNodeSpec =>
  field(label, row([
    { component: "Text", props: { value: empty, size: "2", color: "gray" },
      visible: { source: { state: `${path}/0` }, not: true } },
    { component: "Flex", props: { gap: "1", wrap: "wrap", align: "center" },
      repeat: { source: { state: path } }, children: [...entry] },
  ]))
