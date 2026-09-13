/**
 * agentdeck/adapters/cli-mcp - how one CLI dialect is told about the MCP servers
 * a launch must be able to call (§F10).
 *
 * The dialects do not agree, and the disagreement is not cosmetic. `claude`
 * takes a JSON config as a word in argv — `--mcp-config` accepts files *or*
 * strings, so the door is named inline and nothing is written to the machine's
 * disk. `codex` overrides its own `~/.codex/config.toml` by dotted path and
 * insists on reading the bearer token from the *environment*, which keeps a
 * secret out of an argv that every process on the machine can read. `gemini` has
 * no per-run flag for it at all, and `pi` has no MCP surface to be told about.
 *
 * So a delivery is words plus an environment, and a dialect with no way of being
 * told is refused by `gatewayFor` rather than started with its servers dropped.
 * That refusal is the point of the whole file: an agent whose every call is
 * turned away at the door reports *a permission problem*, which is not what it
 * has, and the operator reads a lie about the wrong layer.
 */
import type { LaunchMcpServer } from "../config-types.ts"

/** One server, as the platform states it. */
type Servers = Readonly<Record<string, LaunchMcpServer>>

/** What telling a dialect about the door costs: words in argv, and the environment they read. */
export interface McpDelivery {
  readonly argv: ReadonlyArray<string>
  readonly env: Readonly<Record<string, string>>
}

export type McpDialect = (servers: Servers) => McpDelivery

/** The dialects' answer when there is nothing to deliver, or nothing left to say about it. */
export const noDelivery: McpDelivery = { argv: [], env: {} }

/**
 * `--strict-mcp-config` is not a convenience. Without it the agent also loads
 * whatever servers its own home directory declares, and the set the platform
 * bound would no longer be the set the agent can reach — the advertised set and
 * the enforced set would be two sets (F8). The token lands in argv and is
 * readable by any process on this machine; that is the price of the only inline
 * route claude has, and the reason `LaunchMcpServer` does not spell a header.
 */
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

/** The variable a codex turn reads one server's bearer token from. */
const tokenVar = (name: string): string => `EFFECT_AGENT_MCP_${name.toUpperCase().replaceAll("-", "_")}`

/**
 * `-c` overrides `~/.codex/config.toml` by dotted path, so a server is named for
 * one run without editing a file the operator owns. The value half is parsed as
 * TOML, which is why every value is JSON-quoted — a bare URL is read as some
 * other kind of value. The token goes in the environment and the config names
 * the variable, which is codex's own route for it and the reason the secret
 * never reaches argv.
 */
export const codexDelivery: McpDialect = (servers) => {
  const argv: string[] = []
  const env: Record<string, string> = {}
  for (const [name, server] of Object.entries(servers)) {
    // TOML reads a dot as nesting, so a name that is not a bare key would be
    // configured under a table nobody asked for instead of being refused
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
