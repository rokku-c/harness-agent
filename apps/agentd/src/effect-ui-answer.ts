/**
 * What a press answered, drawn in the place the press was made.
 *
 * A room is filled by reads rather than by a source, so it has no `/_sources`
 * record to switch on: the only thing that knows the read ever ran is the answer
 * itself. So the guard is the answer's own `ok`, which means a room shows no
 * empty readouts before its first read and never shows a stale one as though it
 * were this read's.
 *
 * A list inside an answer has the same problem one level down and cannot use the
 * source's verdict either: the answer is the only thing that knows it ran, and
 * the answer does not count its own rows. So each list asks its own first row,
 * and says what it has none of in the line the entries would have taken, rather
 * than leaving a label over a blank.
 */
import { field, row, type UiNodeSpec } from "@effect-agent/effect-ui"

/** An answer, shown exactly while it exists. */
export const answer = (guard: string, children: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "3" },
  visible: { source: { state: guard } },
  children: [...children],
})

/** One list inside an answer, with what it says when it carries nothing. */
export const answered = (label: string, path: string, entry: UiNodeSpec | readonly UiNodeSpec[], empty = "None"): UiNodeSpec =>
  field(label, row([
    { component: "Text", props: { value: empty, size: "2", color: "gray" },
      visible: { source: { state: `${path}/0` }, not: true } },
    { component: "Flex", props: { gap: "1", wrap: "wrap", align: "center" },
      repeat: { source: { state: path } }, children: Array.isArray(entry) ? [...entry] : [entry] },
  ]))

/** A field whose value is one string the answer carried, in mono. */
export const answeredChip = (label: string, path: string): UiNodeSpec =>
  field(label, row([{ component: "Code", props: { size: "2" }, bind: path }]))
