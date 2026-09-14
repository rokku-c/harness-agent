import type { DiscoveredSession } from "./types.ts"

export const TAIL_BYTES = 4096
export const TAIL_COUNT = 3

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
