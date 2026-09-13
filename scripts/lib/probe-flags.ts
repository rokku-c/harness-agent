/** The flag surface of the machine program, kept apart from what it then does. */
import type { CollectedHost } from "@effect-agent/agentd-probe"

export const USAGE = `usage: bun run node:probe --url <control-plane> --id <nodeId> [options]

One machine's agentd: announces itself, renews its lease, applies the deployment
the control plane holds for this node, collects what its agents are and the
sessions they have, runs the work the center queues for it, and withdraws on a
clean exit. Outbound calls only, so the machine needs no port of its own.

  --url <base>            agentd control plane, e.g. http://127.0.0.1:8080
  --id <nodeId>           the machine this program speaks for
  --name <label>          human name for the machine. Default: the id
  --capabilities <a,b>    what this machine can run, e.g. abi:effect-1,runtime:os
  --namespaces <a,b>      isolation domains it carries (§8.3), e.g. ops,workspace
  --max-apps <n>          app-count ceiling it states. Omit to state none
  --token <token>         the fleet's node token, when the control plane requires one
  --stage <dir>           install fetched artifacts under this directory (§8.2, P6).
                          Omit to only be told what to run, without fetching it
  --interval <ms>         how long between beats. Default: 1500
  --no-collect            do not collect this machine's facts and sessions.
                          Default: collect them, and report what it found
  --hosts <a,b>           other hosts to read sessions from over ssh, as
                          [user@]host[:port]. They run no agentd of their own
  --facts-interval <ms>   how long between collections. Default: 60000
  --session-limit <n>     cap per agent kind when collecting. Omit for the reader's default
  --no-launch             do not take work from the center. Default: take it
`

export const fail = (message: string): never => {
  process.stderr.write(`${message}\n\n${USAGE}`)
  process.exit(2)
}

export const parse = (argv: readonly string[]): Record<string, string> => {
  const out: Record<string, string> = {}
  for (let at = 0; at < argv.length; at += 1) {
    const flag = argv[at]!
    if (!flag.startsWith("--")) fail(`unexpected argument "${flag}"`)
    const value = argv[at + 1]
    if (value === undefined || value.startsWith("--")) fail(`${flag} needs a value`)
    out[flag.slice(2)] = value
    at += 1
  }
  return out
}

export const csv = (value: string | undefined): readonly string[] =>
  (value ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry !== "")

/** A positive number from a flag, or the fallback when the flag was not given. */
export const number = (given: Record<string, string>, flag: string, fallback?: number): number | undefined => {
  const raw = given[flag]
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) fail(`--${flag} must be a positive number, got "${raw}"`)
  return parsed
}

/**
 * A whole number that may be zero, for a flag where zero is a real answer: an
 * app-count ceiling of none is a machine that takes no apps, not a missing one.
 */
export const ceiling = (given: Record<string, string>, flag: string): number | undefined => {
  const raw = given[flag]
  if (raw === undefined) return undefined
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0) fail(`--${flag} must be a non-negative integer, got "${raw}"`)
  return parsed
}

/** `[user@]host[:port]`, named by the spec itself so two hosts never collide. */export const hostOf = (spec: string): CollectedHost => {
  const at = spec.lastIndexOf("@")
  const rest = at === -1 ? spec : spec.slice(at + 1)
  const user = at === -1 ? undefined : spec.slice(0, at)
  const colon = rest.indexOf(":")
  const host = colon === -1 ? rest : rest.slice(0, colon)
  const port = colon === -1 ? undefined : Number(rest.slice(colon + 1))
  if (host === "" || (port !== undefined && !Number.isInteger(port))) {
    fail(`--hosts entry "${spec}" is not [user@]host[:port]`)
  }
  return { machineId: spec, target: { host, ...(user === undefined ? {} : { user }), ...(port === undefined ? {} : { port }) } }
}
