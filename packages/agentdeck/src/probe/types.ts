/**
 * probe - what an agent on this machine IS, read from its own configuration.
 *
 * The scope is deliberately the common denominator across agents: which model
 * endpoint it talks to, which MCP servers it knows, how it gates permissions.
 * Agent-specific settings that do not generalize are not collected - a probe
 * that reports everything reports nothing usable.
 *
 * SECRETS NEVER LEAVE THIS LAYER. A credential is reported as configured or
 * missing and its value is never read into a result; the same for URLs, which
 * are reduced to a host.
 */
import type { AgentKind } from "../types.ts"

export type { AgentKind }

export type CredentialState = "configured" | "missing" | "unknown"

export interface ProviderFacts {
  /** the provider/endpoint name the agent recorded */
  readonly provider?: string
  readonly model?: string
  /** host only - never the full URL, which may carry credentials */
  readonly baseUrlHost?: string
  readonly credential: CredentialState
}

export interface McpServerFacts {
  readonly name: string
  readonly transport: "stdio" | "http" | "sse" | "unknown"
  /** command or host this server points at */
  readonly target?: string
  readonly scope: "global" | "project"
}

export interface PermissionFacts {
  /** approval / permission mode the agent is set to */
  readonly approval?: string
  readonly allow?: ReadonlyArray<string>
  readonly deny?: ReadonlyArray<string>
  readonly sandbox?: string
}

export interface AgentFacts {
  readonly kind: AgentKind
  readonly installed: boolean
  readonly path?: string
  readonly version?: string
  readonly provider?: ProviderFacts
  readonly mcpServers: ReadonlyArray<McpServerFacts>
  readonly permissions?: PermissionFacts
  /** every file these facts were read from, so a human can check them */
  readonly sources: ReadonlyArray<string>
  /** what could NOT be determined, stated rather than silently omitted */
  readonly notes?: ReadonlyArray<string>
}

export interface MachineFacts {
  readonly home: string
  readonly at: number
  readonly agents: ReadonlyArray<AgentFacts>
}

export interface ProbeOptions {
  readonly home?: string
  /** working directory whose project-scoped config should also be read */
  readonly cwd?: string
  readonly kinds?: ReadonlyArray<AgentKind>
  /** skip spawning `<file> --version` (fast, presence-only probing) */
  readonly skipVersion?: boolean
}
