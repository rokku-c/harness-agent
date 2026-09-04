import { makeCommandQueue, type BoardCommand } from "./queue.ts"

export interface ProbePoll { readonly commands: ReadonlyArray<BoardCommand>; readonly heartbeatAt: number }

export interface ProbeGateway {
  readonly submit: (command: BoardCommand) => void
  readonly poll: (agentId: string) => ProbePoll
  readonly ack: (ids: ReadonlyArray<string>) => void
}

export const makeProbeGateway = (): ProbeGateway => {
  const queue = makeCommandQueue()
  const heartbeats = new Map<string, number>()
  return {
    submit: (command) => queue.enqueue(command),
    poll: (agentId) => {
      const heartbeatAt = Date.now()
      heartbeats.set(agentId, heartbeatAt)
      return { commands: queue.poll(agentId), heartbeatAt }
    },
    ack: (ids) => queue.acknowledge(ids)
  }
}
