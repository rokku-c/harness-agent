/**
 * Central defaults for effect-agent, organized by domain.
 *
 * Rather than scattering single constants, each domain exports one or a few
 * *concept structs* — a concept's defaults live with the concept. Import the
 * struct for the domain you work in, not a long list of globals.
 *
 * Every field is overridable at the call site via the corresponding `options`
 * field on the driver / factory.
 */

/* ── Tool naming domain ─────────────────────────────────────────── */

/** Naming for the synthetic output tool and injected tools. */
export const ToolNaming = {
  /** Name of the tool models must call to return structured output
   *  (the tool-call pattern for `Until.schema`, mirroring Claude Code's `StructuredOutput`). */
  outputToolName: "effect_agent_return",
  /** Prefix applied to injected tool names (empty = no prefix). */
  prefix: "",
  /** MCP channel name for injected tools (Claude Code). */
  mcpChannel: "effect_agent",
  /** Allowed-tool allow-prefix for the effect_agent MCP server (Claude Code). */
  mcpAllowPrefix: "mcp__"
} as const

/* ── Provider driver domain ─────────────────────────────────────── */

/** Max-output-tokens escalation policy (mirrors Claude Code: conservative default,
 *  bump on truncation, cap at an upper limit). */
export interface MaxOutputTokensConfig {
  /** Value sent on the first request. */
  readonly default: number
  /** Factor applied to `default` each time the output is truncated. */
  readonly multiplier: number
  /** How many attempts (including the first) before giving up. */
  readonly maxAttempts: number
  /** Absolute ceiling; escalated values never exceed it. */
  readonly cap: number
}

/** Default escalation policy. deepseek-v4-flash and similar models cap around 4096. */
export const MaxOutputTokens: MaxOutputTokensConfig = {
  default: 32768,
  multiplier: 2,
  maxAttempts: 3,
  cap: 262144
}

/** Optional guard-rails, OFF by default. When set on a driver they bound otherwise-unbounded
 *  loops (tool iterations / schema-correction rounds). Without them the loop runs until the
 *  API reports an error or a result is produced — never a hardcoded cap. */
export const LoopGuardRails = {
  maxToolSteps: undefined as number | undefined,
  maxSchemaRetries: undefined as number | undefined
} as const

/** Driver defaults. */
export const ProviderDefaults = {
  /** Driver implementing a provider. "native" = official SDKs, "vercel" = @ai-sdk/*,
   *  "effect" = Effect's official @effect/ai packages. */
  driver: "native" as const,
  /** Default config file path when none is provided. */
  configPath: "config.toml",
  /** Delay between transient-failure retries. */
  retryDelayMs: 200,
  /** Default structured-output strategy for the Vercel driver ("tool" is more robust). */
  structuredOutput: "tool" as const,
  /** Disable Anthropic thinking by default (deepseek gateway emits thinking blocks
   *  that @ai-sdk/anthropic rejects). Overridable per driver. */
  disableThinking: true
} as const

/* ── SSH domain ─────────────────────────────────────────────────── */

export const SshDefaults = {
  /** Default SSH port when the URI does not specify one. */
  port: 22
} as const

/* ── Composed agent domain (Claude Code) ────────────────────────── */

export const ComposedAgentDefaults = {
  /** Default settings sources override (empty = use SDK defaults). */
  settingSources: [] as readonly string[],
  /** Whether Claude Code sessions persist across runs by default. */
  persistSession: true
} as const
