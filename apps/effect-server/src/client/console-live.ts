/**
 * The console's one live region, and the rule that keeps it worth hearing.
 *
 * `flows.md` §6.2 rule 6: exactly one region, `aria-live="polite"`, announcing
 * four things — the route change and what it contains, a verdict's outcome, a
 * save's outcome, and a source failing — and nothing else, so it stays worth
 * hearing. A region that says everything says nothing, so this module is the
 * scarcity itself: one sentence, no queue, and a later writer replaces the
 * sentence rather than adding to it. An identical repeat is not a change and is
 * dropped, which costs nothing: a region only speaks when what is in it moves.
 *
 * A route is announced by the shell and refined by the place that mounted. The
 * shell knows the route's name and no more, so it says `Inbox`; the place is the
 * only one that knows what the route contains, so it publishes `3 waiting` under
 * the address it is on and the shell composes the two. The composition is the
 * shell's alone — a place that announced for itself would be a second writer
 * racing the first, since a child's effects run before its parent's — and that is
 * why the detail is a cell keyed by address rather than a call.
 *
 * The other three announcements are made where they happen, and one of them has
 * no writer yet: a verdict's outcome arrives with the verdict path
 * (`console-decision-card.tsx` draws no answer button, and says why), and a
 * region announcing a verdict nothing recorded would be this surface's one lie.
 *
 * A detail is published under the route's *kind* rather than its whole address,
 * because selecting a row changes the address without changing where the
 * operator is: `#inbox` and `#inbox/<id>` are one place, and keying by address
 * would make every row press re-say the queue.
 */

import * as React from "react"

let sentence = ""
const details = new Map<string, string>()
const listeners = new Set<() => void>()

const emit = (): void => { for (const listener of listeners) listener() }
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Say one thing. The region's whole vocabulary is this call. */
export const announce = (next: string): void => {
  if (next === sentence) return
  sentence = next
  emit()
}

export const liveSentence = (): string => sentence

/** The sentence the element renders. Nothing else reads it. */
export const useLiveSentence = (): string => React.useSyncExternalStore(subscribe, liveSentence)

/** What a place has said its route contains; the shell composes it with the route's name. */
export const useRouteDetail = (kind: string): string | undefined =>
  React.useSyncExternalStore(subscribe, () => details.get(kind))

/**
 * The route's announcement: its name, and what the place on it has said it holds.
 * The detail arrives when the place's read lands, so a count that lands late is
 * said late — which is right, since a queue that fills up is news.
 */
export const useRouteAnnouncement = (kind: string, title: string): void => {
  const detail = useRouteDetail(kind)
  React.useEffect(() => {
    announce(detail === undefined ? title : `${title}, ${detail}`)
  }, [kind, title, detail])
}

/**
 * What the place on this route kind holds, for as long as it is on it.
 * `undefined` is silence rather than an empty sentence: a place with nothing to
 * count leaves the route's name standing alone, which is the shell's own answer.
 */
export const useRouteDetailFor = (kind: string, detail: string | undefined): void => {
  // Cleared when the place leaves rather than when the detail moves: a count that changed
  // would otherwise blank the sentence and restore it, which is two announcements for one
  // route. Leaving is the only event that makes a route's detail stale.
  React.useEffect(() => () => { if (details.delete(kind)) emit() }, [kind])
  React.useEffect(() => {
    if (detail === undefined || details.get(kind) === detail) return
    details.set(kind, detail)
    emit()
  }, [kind, detail])
}
