/** governor/queue.ts - PURE WAITER-QUEUE HELPERS.
 *  Concept: after a release every parked waiter is re-evaluated in priority
 *  order (then FIFO by enqueue time); orderWaiters produces that ordering
 *  without touching effect state. */
import type { WaitEntry } from "./types.ts"
import { PRIORITY_ORDER } from "./types.ts"

export const orderWaiters = (current: ReadonlyArray<WaitEntry>): ReadonlyArray<WaitEntry> =>
  [...current].sort(
    (a, b) => (PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]) || a.enqueuedAt - b.enqueuedAt
  )
