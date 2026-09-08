import { ERA_RANK, type McpServerRecord, type ProtocolEra } from "./contract.ts"

export interface RegistryPreference {
  readonly serverId?: string
  readonly era?: ProtocolEra
  readonly appsOnly?: boolean
}

export const chooseRecord = (
  records: McpServerRecord[],
  prefer: RegistryPreference = {},
): McpServerRecord | undefined => {
  const candidates = records.filter(
    (record) =>
      record.status !== "offline" &&
      (prefer.era === undefined || record.era === prefer.era) &&
      (prefer.appsOnly !== true || (record.capabilities?.apps ?? 0) > 0 || (record.apps?.length ?? 0) > 0),
  )
  candidates.sort((a, b) => {
    const era = ERA_RANK[a.era] - ERA_RANK[b.era]
    if (era !== 0) return era
    if (a.status !== b.status) return a.status === "healthy" ? -1 : 1
    return b.lastSeen - a.lastSeen
  })
  return candidates[0]
}
