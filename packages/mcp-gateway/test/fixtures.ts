import { makeMcpGateway, type McpGatewayEvent, type McpGatewayRule, type McpServerResolver, type McpUpstream } from "../src/index.ts"
export const resolver: McpServerResolver = { resolve: async ({ serverId }) => serverId ? { serverId, era: "modern" } : undefined }
export const upstream: McpUpstream = { call: async () => ({ status: 200, ok: true, detail: "ok", durationMs: 12 }) }
export const make = (rules?: McpGatewayRule[], override?: McpUpstream, extra?: object) => {
  const events: McpGatewayEvent[] = []
  const gateway = makeMcpGateway({ rules: rules ?? [], resolver, recorder: { record: (e) => void events.push(e) }, upstream: override ?? upstream, ...extra })
  return { events, gateway }
}
