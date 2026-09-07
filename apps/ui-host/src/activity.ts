export interface AgentActivity {
  readonly id: string
  readonly agent: string
  readonly status: string
  readonly at: number
}

export interface ActivityStore {
  setStatus(agent: string, status: string): AgentActivity
  list(): ReadonlyArray<AgentActivity>
  statuses(): Readonly<Record<string, string>>
}

export const makeActivityStore = (): ActivityStore => {
  const events: AgentActivity[] = []
  const statuses = new Map<string, string>()
  return {
    setStatus: (agent, status) => {
      const event = { id: crypto.randomUUID(), agent, status, at: Date.now() }
      if (status === "") statuses.delete(agent); else statuses.set(agent, status)
      events.unshift(event)
      if (events.length > 100) events.length = 100
      return event
    },
    list: () => events.map((event) => ({ ...event })),
    statuses: () => Object.fromEntries(statuses)
  }
}
