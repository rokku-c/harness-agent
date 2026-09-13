import {
  discoverSessions, installPlans, makeSshTransport, probeMachine, remoteSessions,
  type RemoteTarget,
} from "@effect-agent/agentdeck"
import type { CollectedMachine, FactSource } from "./facts-cycle.ts"

/** A host this machine reads for, because it runs no agentd of its own. */
export interface CollectedHost {
  readonly machineId: string
  readonly target: RemoteTarget
}

export interface MachineCollection extends CollectedMachine {
  /**
   * Hosts reached over ssh. They are read only, and only for sessions: what is
   * *installed* there is what that machine's own probe would say, and running one
   * on a host is exactly what deploying agentd there does.
   */
  readonly hosts?: readonly CollectedHost[]
  /** Cap per kind, newest first. */
  readonly limit?: number
}

/**
 * This machine's own answers, plus the hosts it reads for. The facts payload is
 * `probeMachine`'s, with the install plans it could run appended: a package name
 * is the machine's business, and the center installs what it was told rather
 * than a name it looked up.
 */
const collectLocal = async (options: MachineCollection): Promise<CollectedMachine> => {
  // the cap is discovery's: probing asks what is installed, and a machine's
  // agent list is short enough that capping it would only hide one
  const scope = options.limit === undefined ? {} : { limit: options.limit }
  const [machine, sessions] = await Promise.all([probeMachine(), discoverSessions(scope)])
  return {
    machineId: options.machineId,
    facts: { ...machine, installs: [...installPlans("npm"), ...installPlans("bun")] },
    sessions,
  }
}

/**
 * A host that did not answer reports why instead of reporting nothing. An empty
 * session list would be the same answer as an idle machine, and the center would
 * go on showing a stale snapshot as if it were current.
 */
const collectHost = async (host: CollectedHost, limit: number | undefined): Promise<CollectedMachine> => {
  const found = await remoteSessions(makeSshTransport(host.target), limit === undefined ? {} : { limit })
  return found.ok ? { machineId: host.machineId, sessions: found.sessions } : { machineId: host.machineId, note: found.error }
}

export const makeFactSource = (options: MachineCollection): FactSource => ({
  collect: async () => {
    const collected: CollectedMachine[] = [await collectLocal(options)]
    for (const host of options.hosts ?? []) collected.push(await collectHost(host, options.limit))
    return collected
  },
})
