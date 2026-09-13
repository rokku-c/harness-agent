/**
 * Which sessions carry a transcript, and how much of it.
 *
 * A machine reports the facts of every session it has and the tail of the few
 * most recent: "what did the agent before me do" is a question about the session
 * that just ended, and a fleet-wide collection that shipped every transcript
 * would grow with use rather than with need. Full transcripts stay on the disk
 * they were written to — the center holds a window, not a copy.
 */
import type { DiscoveredSession } from "./types.ts"

/** How much of one transcript travels: the last exchange, not the session. */
export const TAIL_BYTES = 4096
/** How many sessions carry one. */
export const TAIL_COUNT = 3

/**
 * Attach a tail to the newest `TAIL_COUNT` sessions. A session whose transcript
 * could not be read keeps its facts and ships without a tail: an unreadable file
 * is a gap in the answer, not a failed collection.
 *
 * "The newest few" is a *position* here, not a name. Both callers hand this a
 * list they have already put newest-first, and a position is the only thing that
 * identifies a transcript: a session id is not unique on a machine — resuming a
 * conversation writes a new record under each working directory it was resumed
 * in — so selecting by id shipped the tail of every copy of the three newest
 * conversations instead of three of them.
 */
export const attachTails = async (
  sessions: ReadonlyArray<DiscoveredSession>,
  read: (session: DiscoveredSession, index: number) => Promise<string | undefined>,
): Promise<ReadonlyArray<DiscoveredSession>> => {
  const wanted = new Set(sessions.slice(0, TAIL_COUNT).map((_session, index) => index))
  return await Promise.all(sessions.map(async (session, index) => {
    if (!wanted.has(index)) return session
    const tail = await read(session, index).catch(() => undefined)
    return tail === undefined || tail === "" ? session : { ...session, tail }
  }))
}
