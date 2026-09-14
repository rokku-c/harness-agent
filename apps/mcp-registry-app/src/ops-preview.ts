import { OperationFault, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { HttpSend } from "@effect-agent/effect-network"
import type { Registry } from "@effect-agent/mcp-registry"
import { readResourcePreview } from "./resource-preview.ts"

const preview = async (registry: Registry, send: HttpSend, serverId: string, uri: string): Promise<unknown> => {
  const server = registry.get(serverId)
  if (server === undefined) throw new OperationFault(404, "server not found")
  try { return await readResourcePreview(server, uri, send) }
  catch (error) { throw new OperationFault(502, error instanceof Error ? error.message : String(error)) }
}

export const previewOperations = (registry: Registry, send: HttpSend): readonly Operation[] => [
  operation({
    name: "mcp_registry_preview",
    description: "Read a ui:// resource a registered server declares, over that server's own MCP endpoint",
    access: "read", input: z.object({ serverId: z.string().min(1), uri: z.string().min(1) }).strict(),
    http: { method: "GET", path: "/mcp-registry/preview" },
    handler: (input) => preview(registry, send, input.serverId, input.uri),
  }),
]
