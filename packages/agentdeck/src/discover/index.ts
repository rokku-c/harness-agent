/**
 * The discovery registry: one entry per agent whose sessions can be read off
 * this machine. Adding an agent means adding one source here - callers ask for
 * "sessions" and never enumerate stores themselves.
 */
import { homedir } from "node:os"
import { join } from "node:path"
import type { AgentKind } from "../kinds.ts"
import { codexSource } from "./codex.ts"
import { mapLimit } from "./bounds.ts"
import { readTail } from "./files.ts"
import { geminiSource } from "./gemini.ts"
import { makeJsonlSource } from "./jsonl.ts"
import { attachTails, TAIL_BYTES } from "./tails.ts"
import type { DiscoverOptions, DiscoveredSession, SessionSource } from "./types.ts"

export * from "./types.ts"
export { remoteSessions } from "./remote.ts"
export type { RemoteDiscovery } from "./remote.ts"
export { COLLECTOR, COLLECTOR_LIMIT } from "./collector.ts"

export const sessionSources: ReadonlyArray<SessionSource> = [
  makeJsonlSource("claude-code", join(".claude", "projects")),
  makeJsonlSource("pi", join(".pi", "agent", "sessions")),
  codexSource,
  geminiSource
]

/** kinds whose sessions can be recovered from disk */
export const discoveryKinds: ReadonlyArray<AgentKind> = sessionSources.map((source) => source.kind)

export const DEFAULT_LIMIT = 50

/**
 * Every session the given kinds have on this machine, newest first. Kinds
 * without a reader contribute nothing; a kind whose store is missing or
 * unreadable contributes nothing. No throw path: the caller is enumerating a
 * machine it does not own.
 */
export const discoverSessions = async (
  options: DiscoverOptions = {}
): Promise<ReadonlyArray<DiscoveredSession>> => {
  const home = options.home ?? homedir()
  const limit = options.limit ?? DEFAULT_LIMIT
  const wanted = options.kinds
  const chosen = wanted === undefined
    ? sessionSources
    : sessionSources.filter((source) => wanted.includes(source.kind))
  const found = await mapLimit(chosen, 4, (source) => source.discover(home, limit))
  const recent = found.flat().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit)
  // the tails are attached here rather than per source, because "the newest few
  // sessions" is a fact about the machine and not about one agent's store
  return await attachTails(recent, async (session) => await readTail(session.source, TAIL_BYTES))
}
