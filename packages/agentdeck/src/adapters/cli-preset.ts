import type { UnifiedAgentConfig } from "../config-types.ts"
import { claudeDelivery, codexDelivery, noDelivery, type McpDelivery, type McpDialect } from "./cli-mcp.ts"

export interface CliPreset {
  readonly file: string
  readonly argv: (prompt: string) => ReadonlyArray<string>
  readonly gateway?: McpDialect
}

export const cliPresets: Readonly<Record<string, CliPreset>> = {
  "claude-code": { file: "claude", argv: () => ["-p"], gateway: claudeDelivery },
  codex: { file: "codex", argv: () => ["exec"], gateway: codexDelivery },
  gemini: { file: "gemini", argv: () => [] }, // gemini >=0.24: positional one-shot prompt
  pi: { file: "pi", argv: () => ["-p"] },
  custom: { file: "agent", argv: () => [] }
}

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

export interface CliInvocation {
  readonly file: string
  readonly argv: ReadonlyArray<string>
  readonly env: Readonly<Record<string, string>>
}

export const cliInvocation = (
  config: UnifiedAgentConfig,
  prompt: string,
  presetMap: Readonly<Record<string, CliPreset>> = cliPresets
): CliInvocation => {
  const preset = presetMap[config.kind] ?? presetMap.custom
  const delivery = gatewayFor(config, preset)
  const prefix: ReadonlyArray<string> = config.command !== undefined
    ? (config.args ?? [])
    : [...delivery.argv, ...preset.argv(prompt)]
  const tail: ReadonlyArray<string> = prompt === "" ? [] : [prompt]
  return { file: config.command ?? preset.file, argv: [...prefix, ...tail], env: delivery.env }
}
