/**
 * agentdeck/adapters/cli-preset - the declarative per-kind CLI dialect: how one
 * turn becomes a process argv (ask 3, lossless), and how that process is told
 * about the platform's tool door (§F10).
 *
 * Rendered here rather than inside the gateway because it has two callers: the
 * gateway that spawns the turn, and the launch layer and console that SHOW the
 * plan before anyone runs it.
 */
import type { UnifiedAgentConfig } from "../config-types.ts"
import { claudeDelivery, codexDelivery, noDelivery, type McpDelivery, type McpDialect } from "./cli-mcp.ts"

/** declarative per-kind CLI dialect: how one turn becomes a process argv */
export interface CliPreset {
  readonly file: string
  /** argv BEFORE the prompt text (the prompt is appended last) */
  readonly argv: (prompt: string) => ReadonlyArray<string>
  /**
   * How this dialect is told about the MCP servers it must reach, or absent when
   * it cannot be told at all. Absent is a fact about the CLI, not a default: a
   * turn whose servers were dropped does not fail at the door, it fails as a
   * permission problem inside an agent that was told the tool exists.
   */
  readonly gateway?: McpDialect
}

export const cliPresets: Readonly<Record<string, CliPreset>> = {
  "claude-code": { file: "claude", argv: () => ["-p"], gateway: claudeDelivery },
  codex: { file: "codex", argv: () => ["exec"], gateway: codexDelivery },
  gemini: { file: "gemini", argv: () => [] }, // gemini >=0.24: positional one-shot prompt
  pi: { file: "pi", argv: () => ["-p"] },
  custom: { file: "agent", argv: () => [] }
}

/**
 * The three answers, in one place: there is nothing to deliver, this config asks
 * for something no dialect can honour, or this dialect cannot be told.
 *
 * All three are decided here rather than at the spawn, because this is the
 * function that turns a config into a process: a refusal that arrived after the
 * spawn would be a process already running without its tools. An explicit
 * command is refused with a server list because its argv is the caller's — there
 * is nowhere to put a dialect's words, and dropping them quietly is the failure
 * this file exists to prevent.
 */
export const gatewayFor = (config: UnifiedAgentConfig, preset: CliPreset): McpDelivery => {
  if (config.mcp === undefined) return noDelivery
  if (config.command !== undefined) {
    throw new Error("an MCP Gateway configuration cannot be given to an explicit command; name an agent kind instead")
  }
  if (preset.gateway === undefined) {
    throw new Error(`the ${config.kind} dialect cannot be told about the MCP Gateway; an agent started under it would have none of the platform's tools`)
  }
  return preset.gateway(config.mcp)
}

/** A process to spawn for one turn: the words, and the environment they read. */
export interface CliInvocation {
  readonly file: string
  readonly argv: ReadonlyArray<string>
  readonly env: Readonly<Record<string, string>>
}

/**
 * Standalone render: unified config -> the exact process for one turn (shared by
 * the gateway and by products that want to SHOW the plan before running it).
 * Prompt is appended last.
 *
 * What this returns can carry a credential — a dialect's words and environment
 * are where a secret is written — so it is what a machine *spawns*, and never
 * something a console draws back.
 */
export const cliInvocation = (
  config: UnifiedAgentConfig,
  prompt: string,
  presetMap: Readonly<Record<string, CliPreset>> = cliPresets
): CliInvocation => {
  const preset = presetMap[config.kind] ?? presetMap.custom
  const delivery = gatewayFor(config, preset)
  // the door's words come first and end on a boolean flag: `--mcp-config` is
  // variadic, so a config word immediately before the prompt would eat it
  const prefix: ReadonlyArray<string> = config.command !== undefined
    ? (config.args ?? [])
    : [...delivery.argv, ...preset.argv(prompt)]
  // an empty prompt is not a turn: appending it would hand a command launch —
  // `npm install -g …`, say — a stray empty argument it never asked for
  const tail: ReadonlyArray<string> = prompt === "" ? [] : [prompt]
  return { file: config.command ?? preset.file, argv: [...prefix, ...tail], env: delivery.env }
}
