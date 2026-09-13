/**
 * The one part of a screen that scrolls.
 *
 * A view fills the area the shell leaves it, which makes the whole view the
 * scrollbar unless something in it says otherwise — and a view that scrolls as
 * a whole takes its own controls away with it: an operator presses a button and
 * the line saying what happened is below the fold. A region is that "otherwise".
 * It takes the room the rest of the view left and scrolls inside itself, so
 * everything outside it — the heading, the form, the line the last press wrote —
 * keeps its place and stays in sight.
 *
 * The scroll box is a plain `Box` and the column inside it is a plain `Flex`,
 * which is the one structural thing here worth not simplifying away. A flex
 * container with a height and `overflow: auto` does not scroll a child taller
 * than itself; it *shrinks* it — `flex-shrink` defaults to 1 — and only then
 * finds nothing to scroll. That is invisible until the child clips its own
 * overflow, which is exactly what a card does, and then the bottom of a long
 * list is not scrolled past but quietly missing. A block box has no such rule:
 * its children keep the height they asked for and it scrolls them.
 *
 * Both are the design system's own components with its own layout props; there
 * is nothing here to learn that Radix did not already say. A view with nothing
 * long enough to need a region declares none and scrolls as a whole.
 *
 * `flexBasis: 0` is the third line, and it is what keeps a region from being
 * paid for by the rest of the view. A flex item's base size is its content, so a
 * column holding a long region and a short form has to give up the difference,
 * and shrink is shared out in proportion to base size — the tall one gives up
 * most of it, but the form gives up some, and a form that is `overflow: hidden`
 * loses the bottom of itself with nothing to scroll. Claiming a base of zero
 * says the region's height is whatever is left over and never a reason for
 * anything above it to move.
 */

import type { UiNodeSpec } from "./spec.ts"

export const region = (children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Box", props: { flexGrow: "1", flexBasis: "0", minHeight: "0", overflow: "auto" },
    children: [{ component: "Flex", props: { direction: "column", gap: "4" }, children }] })
