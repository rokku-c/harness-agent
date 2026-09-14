import type { CatalogEntry, McpSetReader, McpSetResolution } from "@effect-agent/mcp-gateway"

export interface Refusal {
  readonly sets: McpSetReader
  readonly agentId: string
  readonly bound: boolean
  readonly tool?: string
  readonly entry?: CatalogEntry
  readonly resolution?: McpSetResolution
}

export interface Fixing {
  readonly label: string
  readonly agentId: string
  readonly setId?: string
  readonly list?: "allowTools" | "denyTools"
  readonly tool?: string
  readonly serverId?: string
}

export interface RefusalAnswer {
  readonly reasons: readonly string[]
  readonly fixing?: Fixing
}

export const refusalAnswer = (refusal: Refusal): RefusalAnswer => {
  const { sets, agentId, bound, tool, entry, resolution } = refusal
  if (tool !== undefined && entry === undefined) return { reasons: [`no server offers ${tool}`] }
  if (!bound) return {
    reasons: ["no set bound to this agent"],
    fixing: { label: `Bind ${agentId} to a set`, agentId },
  }
  if (resolution === undefined) {
    const reachableElsewhere = entry !== undefined && sets.resolve({ agent: agentId, tool: entry.tool }) !== undefined
    return reachableElsewhere && entry !== undefined
      ? {
        reasons: [`${entry.serverId} is in no set bound to this agent`],
        fixing: { label: `Add ${entry.serverId} to a set bound to ${agentId}`, agentId, serverId: entry.serverId },
      }
      : {
        reasons: ["no bound set has a reachable server"],
        fixing: { label: `Add a reachable server to a set bound to ${agentId}`, agentId },
      }
  }
  if (resolution.refusedBy === undefined || entry === undefined) return { reasons: [] }
  return resolution.refusedBy === "deny"
    ? {
      reasons: [`${resolution.setId} explicitly denies ${entry.tool}`],
      fixing: {
        label: `Remove ${entry.tool} from ${resolution.setId}'s deny list`, agentId,
        setId: resolution.setId, list: "denyTools", tool: entry.tool,
      },
    }
    : {
      reasons: [`${resolution.setId} allowlist does not include ${entry.tool}`],
      fixing: {
        label: `Add ${entry.tool} to ${resolution.setId}`, agentId,
        setId: resolution.setId, list: "allowTools", tool: entry.tool,
      },
    }
}
