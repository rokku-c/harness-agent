/**
 * How long to wait for the answer to a call that asks Herdr to hold it open.
 *
 * A held call has two deadlines, and they are not the same one. Given the hold
 * itself as this client's deadline, the timer here fires first — it starts
 * before the request is even written — and reports Herdr's silence about a call
 * Herdr in fact answered at the moment it was asked to stop. Herdr's own verdict
 * is the useful one, so the socket outlives it.
 */

/** Herdr overshoots a hold slightly before answering at its own deadline. */
const HOLD_MARGIN_MS = 1_000

/** `undefined` when nothing was held: the client's configured deadline stands. */
export const holdDeadlineMs = (holdMs: number | undefined): number | undefined =>
  holdMs === undefined ? undefined : holdMs + HOLD_MARGIN_MS
