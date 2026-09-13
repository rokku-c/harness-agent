/**
 * A claim: what the queue may hand out, and what is over.
 *
 * Kept apart from the queue that stores intents because it is the rule and not
 * the store — `Formal/Launch.lean` models this file, and `launches.ts` is what
 * applies it.
 */
import type { LaunchIntent, LaunchState } from "./launch-types.ts"

/** The states an intent is still in play under; the rest are somebody's answer. */
const OPEN: readonly LaunchState[] = ["queued", "claimed", "running"]

/** Whether the intent has been answered — a settled one is handed out to nobody. */
export const settled = (state: LaunchState): boolean => !OPEN.includes(state)

/**
 * A claim outlives nothing. The machine that took one says nothing until it
 * reports, so an intent claimed and not reported on is either a machine starting
 * up or a machine that went away, and nothing here can tell them apart. The
 * deadline is what makes the second recoverable: what a dead machine held is
 * offered again, and it cannot race a report — a machine that can report is not
 * the one this is for.
 *
 * A machine claims before it runs, so the deadline has to outlast a batch.
 *
 * `running` is not re-offered. By then the machine has said it started, so the
 * work may be half done, and running it again in the same directory is worse
 * than a record that stays visibly stuck.
 */
export const claimLapsed = (intent: LaunchIntent, at: number, claimTtlMs: number): boolean =>
  intent.state === "claimed" && (intent.claimedAt ?? 0) + claimTtlMs <= at
