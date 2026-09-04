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

export const serialize = (queue: CommandQueue): string => JSON.stringify(queue)

export const deserialize = (raw: string): CommandQueue => {
  const value = JSON.parse(raw) as { commands?: unknown }
  if (!Array.isArray(value.commands)) throw new Error("invalid command queue snapshot")
  const commands = value.commands.filter((item): item is BoardCommand => {
    if (!item || typeof item !== "object") return false
    const command = item as Record<string, unknown>
    return typeof command.id === "string" && typeof command.agentId === "string" && typeof command.runId === "string" && ["launch", "stop", "consent_resolve", "merge"].includes(String(command.kind))
  })
  return { commands }
}

export const emptyQueue = (): CommandQueue => ({ commands: [] })

export const enqueue = (queue: CommandQueue, command: BoardCommand): CommandQueue =>
  queue.commands.some((item) => item.id === command.id) ? queue : { commands: [...queue.commands, command] }

export const poll = (queue: CommandQueue, agentId: string): ReadonlyArray<BoardCommand> =>
  queue.commands.filter((command) => command.agentId === agentId)

export const acknowledge = (queue: CommandQueue, ids: ReadonlyArray<string>): CommandQueue => {
  const accepted = new Set(ids)
  return { commands: queue.commands.filter((command) => !accepted.has(command.id)) }
}

export const makeCommandQueue = () => {
  let current = emptyQueue()
  return {
    enqueue: (command: BoardCommand): void => { current = enqueue(current, command) },
    poll: (agentId: string): ReadonlyArray<BoardCommand> => poll(current, agentId),
    acknowledge: (ids: ReadonlyArray<string>): void => { current = acknowledge(current, ids) },
    snapshot: (): CommandQueue => current
  }
}
