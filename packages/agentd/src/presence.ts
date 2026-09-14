export interface LeaseClock {
  now(): number
  monotonic(): number
}

export interface NodePresence {
  readonly nodeId: string
  readonly online: boolean
  readonly lastSeen?: number
  readonly presentSince?: number
  readonly ageMs?: number
  readonly withdrawn: boolean
}

export interface NodePresenceOptions {
  readonly leaseTtlMs?: number
  readonly clock?: Partial<LeaseClock>
}

export interface NodePresenceTable {
  announce(nodeId: string): NodePresence
  heartbeat(nodeId: string): NodePresence | undefined
  withdraw(nodeId: string): NodePresence | undefined
  presence(nodeId: string): NodePresence | undefined
  list(): readonly NodePresence[]
}
