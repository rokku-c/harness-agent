/**
 * Session discovery on a machine we reach over ssh.
 *
 * Unlike local discovery - which quietly returns fewer sessions for anything it
 * cannot read, because it is enumerating the machine it runs on - a remote
 * result is a typed outcome. "This machine has no sessions" and "this machine
 * did not answer" are different facts, and a control plane that conflates them
 * will report an unreachable host as idle.
 */
import type { AgentKind } from "../types.ts"
import type { RemoteTransport } from "../remote/types.ts"
import { COLLECTOR, COLLECTOR_KINDS, COLLECTOR_LIMIT } from "./collector.ts"
import { remoteTail } from "./remote-tail.ts"
import { attachTails } from "./tails.ts"
import type { DiscoveredSession } from "./types.ts"

export type RemoteDiscovery =
  | { readonly ok: true; readonly sessions: ReadonlyArray<DiscoveredSession> }
  | { readonly ok: false; readonly error: string }

/** one index line: the session it describes, and where its transcript lives */
interface Parsed {
  readonly session: DiscoveredSession
  readonly path?: string
}

const KINDS: ReadonlyArray<string> = COLLECTOR_KINDS

const asKind = (value: string): AgentKind | undefined =>
  KINDS.includes(value) ? (value as AgentKind) : undefined

const parseLine = (line: string, source: string): Parsed | undefined => {
  const [rawKind, sessionId, cwd, rawMtime, rawSize, path] = line.split("\t")
  const kind = rawKind === undefined ? undefined : asKind(rawKind)
  if (kind === undefined || sessionId === undefined || sessionId.length === 0) return undefined
  const updatedAt = Number(rawMtime) * 1000
  const bytes = Number(rawSize)
  return {
    // a machine that predates the path field still lists sessions; it just has
    // no transcript to hand over, which is the same as an unreadable one
    path: path !== undefined && path.length > 0 ? path : undefined,
    session: {
      kind,
      sessionId,
      cwd: cwd !== undefined && cwd.length > 0 ? cwd : undefined,
      // the collector reads an index, not transcripts: no title, and the store's
      // mtime is the only timestamp a remote listing can honestly report
      startedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      bytes: Number.isFinite(bytes) ? bytes : 0,
      source
    }
  }
}

/** What this machine has, or why we could not find out. */
export const remoteSessions = async (
  transport: RemoteTransport,
  options: { readonly limit?: number; readonly timeoutMs?: number } = {}
): Promise<RemoteDiscovery> => {
  const limit = options.limit ?? COLLECTOR_LIMIT
  const run = await transport.run(`sh -s ${limit}`, {
    stdin: COLLECTOR,
    ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {})
  })
  const where = `${transport.target.user ?? ""}${transport.target.user !== undefined ? "@" : ""}${transport.target.host}`
  if (run.timedOut) return { ok: false, error: `${where} timed out after ${options.timeoutMs ?? 30000}ms` }
  if (run.code !== 0) return { ok: false, error: `${where}: ${run.stderr.trim() || `exit code ${run.code}`}` }
  const found = run.stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => parseLine(line, `ssh://${where}`))
    .filter((entry): entry is Parsed => entry !== undefined)
    .sort((a, b) => b.session.updatedAt - a.session.updatedAt)
  const sessions = await attachTails(
    found.map((entry) => entry.session),
    // the index is the identity: a session id repeats across the records of a
    // conversation that was resumed in more than one working directory
    async (_session, index) => {
      const path = found[index]?.path
      return path === undefined ? undefined : await remoteTail(transport, path)
    }
  )
  return { ok: true, sessions }
}
