import {
  discoverSessions, installPlans, makeSshTransport, probeMachine, remoteSessions,
  type RemoteTarget,
} from "@effect-agent/agentdeck"
import type { CollectedMachine, FactSource } from "./facts-cycle.ts"

export interface CollectedHost {
  readonly machineId: string
  readonly target: RemoteTarget
}

export interface MachineCollection extends CollectedMachine {
  readonly hosts?: readonly CollectedHost[]
  readonly limit?: number
}

const collectLocal = async (options: MachineCollection): Promise<CollectedMachine> => {
  const scope = options.limit === undefined ? {} : { limit: options.limit }
  const [machine, sessions] = await Promise.all([probeMachine(), discoverSessions(scope)])
  return {
    machineId: options.machineId,
    facts: { ...machine, installs: [...installPlans("npm"), ...installPlans("bun")] },
    sessions,
  }
}

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
