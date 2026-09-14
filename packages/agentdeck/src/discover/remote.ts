import type { AgentKind } from "../kinds.ts"
import type { RemoteTransport } from "../remote/types.ts"
import { COLLECTOR, COLLECTOR_KINDS, COLLECTOR_LIMIT } from "./collector.ts"
import { remoteTail } from "./remote-tail.ts"
import { attachTails } from "./tails.ts"
import type { DiscoveredSession } from "./types.ts"

export type RemoteDiscovery =
  | { readonly ok: true; readonly sessions: ReadonlyArray<DiscoveredSession> }
  | { readonly ok: false; readonly error: string }

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
    path: path !== undefined && path.length > 0 ? path : undefined,
    session: {
      kind,
      sessionId,
      cwd: cwd !== undefined && cwd.length > 0 ? cwd : undefined,
      startedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      bytes: Number.isFinite(bytes) ? bytes : 0,
      source
    }
  }
}

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
    async (_session, index) => {
      const path = found[index]?.path
      return path === undefined ? undefined : await remoteTail(transport, path)
    }
  )
  return { ok: true, sessions }
}
