export type CommandKind = "launch" | "stop" | "consent_resolve" | "merge"

export interface BoardCommand {
  readonly id: string
  readonly agentId: string
  readonly kind: CommandKind
  readonly runId: string
  readonly payload?: Readonly<Record<string, unknown>>
  readonly createdAt: number
}

export interface CommandQueue { readonly commands: ReadonlyArray<BoardCommand> }

export const emptyQueue = (): CommandQueue => ({ commands: [] })

export const enqueue = (queue: CommandQueue, command: BoardCommand): CommandQueue =>
  queue.commands.some((item) => item.id === command.id) ? queue : { commands: [...queue.commands, command] }

export const poll = (queue: CommandQueue, agentId: string): ReadonlyArray<BoardCommand> =>
  queue.commands.filter((command) => command.agentId === agentId)

export const acknowledge = (queue: CommandQueue, ids: ReadonlyArray<string>): CommandQueue => {
  const accepted = new Set(ids)
  return { commands: queue.commands.filter((command) => !accepted.has(command.id)) }
}
