/**
 * The destinations this session pushed, so Back can mean the same thing as the
 * browser's back button — and something sane when there is nothing behind it.
 *
 * The address bar is still the only route record (console-nav.ts). What is kept
 * here is not a second copy of where the reader is, but the one fact the address
 * bar cannot answer: **did this session walk here, or did the reader arrive at
 * this address directly?** A screen entered by a press has the screen it came
 * from behind it; a screen pasted into the address bar has nothing behind it.
 *
 * Back has to be those two different things, and each of them has a wrong
 * answer: `history.back()` from a pasted link leaves the product entirely, and
 * going to the parent screen from a walked link re-enters the screen you just
 * left when the reader then presses the browser's own back. So:
 *
 *   * this session pushed the entry below → `history.back()`, which is the same
 *     stack the browser pops, and keeps every ancestor's parameters;
 *   * it did not → the parent screen, which is the chain the view declares
 *     (screen.ts) and the one thing that is true without a history.
 *
 * The stack is reconciled from `hashchange` rather than maintained by hand, so
 * the browser's back button, a typed address and a press all leave it correct.
 */

/** The current hash, then the ones below it, oldest first. Never empty once observed. */
let entries: readonly string[] = []

const current = (): string | undefined => entries[entries.length - 1]

/** The destination one below the top: what the browser's back button lands on. */
export const backTarget = (): string | undefined =>
  entries.length < 2 ? undefined : entries[entries.length - 2]

/** Whether this session walked here — i.e. whether there is a real entry behind this one. */
export const canGoBack = (): boolean => entries.length >= 2

/** A hash this module pushed itself. Recorded here, because `hashchange` cannot tell who set it. */
export const pushed = (hash: string): void => { entries = [...entries, hash] }

/**
 * The address changed. Either it is the change this module just made, or it is
 * the browser's — a back button, a forward button, or a typed address.
 *
 * A move to the entry below the top is a pop, and pops exactly one: the reader
 * went back one step, and everything under that step is still behind them. Any
 * other move is a jump the stack knows nothing about, so the stack becomes that
 * one destination — which is what makes `canGoBack()` false for a target the
 * reader typed or pasted, and leaves Back meaning "up to the parent".
 */
const reconcile = (hash: string): void => {
  if (hash === current()) return
  entries = hash === backTarget() ? entries.slice(0, -1) : [hash]
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => { reconcile(window.location.hash) })
  reconcile(window.location.hash)
}
