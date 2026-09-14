import type { LaunchMcpServer } from "../config-types.ts"

type Servers = Readonly<Record<string, LaunchMcpServer>>

export interface McpDelivery {
  readonly argv: ReadonlyArray<string>
  readonly env: Readonly<Record<string, string>>
}

export type McpDialect = (servers: Servers) => McpDelivery

export const noDelivery: McpDelivery = { argv: [], env: {} }

export const claudeDelivery: McpDialect = (servers) => ({
  argv: [
    `--mcp-config=${JSON.stringify({
      mcpServers: Object.fromEntries(Object.entries(servers).map(([name, server]) => [
        name, { url: server.url, headers: { authorization: `Bearer ${server.token}` } },
      ])),
    })}`,
    "--strict-mcp-config",
  ],
  env: {},
})

const tokenVar = (name: string): string => `EFFECT_AGENT_MCP_${name.toUpperCase().replaceAll("-", "_")}`

export const codexDelivery: McpDialect = (servers) => {
  const argv: string[] = []
  const env: Record<string, string> = {}
  for (const [name, server] of Object.entries(servers)) {
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      throw new Error(`codex names an MCP server by dotted path, so "${name}" cannot be a server name`)
    }
    const variable = tokenVar(name)
    argv.push("-c", `mcp_servers.${name}.url=${JSON.stringify(server.url)}`)
    argv.push("-c", `mcp_servers.${name}.bearer_token_env_var=${JSON.stringify(variable)}`)
    env[variable] = server.token
  }
  return { argv, env }
}
